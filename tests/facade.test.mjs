import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function makePdf(pageCount = 5) {
  const pageObjectStart = 3;
  const contentObjectStart = pageObjectStart + pageCount;
  const fontObject = contentObjectStart + pageCount;
  const pageRefs = Array.from({ length: pageCount }, (_, index) => `${pageObjectStart + index} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`,
    ...Array.from({ length: pageCount }, (_, index) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...Array.from({ length: pageCount }, (_, index) => {
      const stream = `BT /F1 24 Tf 72 720 Td (Page ${index + 1}) Tj ET`;
      return `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
    }),
  ];
  const chunks = [Buffer.from("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n", "binary")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets[index + 1] = offset;
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "binary");
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}`;
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, "binary"));
  return Buffer.concat(chunks);
}

const fixturePath = join(mkdtempSync(join(tmpdir(), "pi-web-access-lean-")), "fixture.pdf");
writeFileSync(fixturePath, makePdf());

import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const extensionModule = await jiti.import("../index.ts");
const extension = extensionModule.default ?? extensionModule;
const { createWebAccessFacade } = extensionModule;

function createPi() {
  const tools = [];
  const handlers = new Map();
  const noOp = () => undefined;
  const pi = new Proxy(
    {
      tools,
      handlers,
      registerTool(tool) {
        tools.push(tool);
      },
      on(event, handler) {
        const listeners = handlers.get(event) ?? [];
        listeners.push(handler);
        handlers.set(event, listeners);
      },
      registerCommand: noOp,
      registerShortcut: noOp,
      registerMessageRenderer: noOp,
      registerProvider: noOp,
      registerFlag: noOp,
      getFlag: () => undefined,
      getActiveTools: () => [],
      getAllTools: () => [],
      setActiveTools: noOp,
      appendEntry: noOp,
      sendMessage: noOp,
      events: { on: noOp, emit: noOp },
    },
    {
      get(target, property) {
        return property in target ? target[property] : noOp;
      },
    },
  );
  return pi;
}

function facadeTool(pi) {
  return pi.tools.find((tool) => tool.name === "web_access");
}

test("registers one web_access facade instead of four provider tools", () => {
  const pi = createPi();

  extension(pi);

  assert.deepEqual(
    pi.tools.map((tool) => tool.name),
    ["web_access"],
  );
});

test("real upstream help exposes the 0.46 search parameter surface", async () => {
  const pi = createPi();
  extension(pi);
  const result = await facadeTool(pi).execute("help-search", { op: "help", input: "search" });
  const text = result.content.map((item) => item.text ?? "").join("\n");
  const schema = JSON.parse(text.slice(text.indexOf("{")));
  // Since 0.45 provider is one string (comma-separated names) and model picks a per-call model.
  assert.equal(schema.properties.provider.type, "string");
  assert.match(schema.properties.provider.description, /comma-separated/);
  assert.equal(schema.properties.model.type, "string");
});

test("search shorthand forwards the original execution context", async () => {
  const calls = [];
  const expected = {
    content: [{ type: "text", text: "search result" }],
    details: { responseId: "response-1" },
  };
  const upstream = (pi) => {
    pi.registerTool({
      name: "web_search",
      async execute(...args) {
        calls.push(args);
        return expected;
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  const signal = new AbortController().signal;
  const onUpdate = () => undefined;
  const context = { cwd: "C:/work" };

  const result = await facadeTool(pi).execute(
    "call-1",
    { op: "search", input: "Pi coding agent" },
    signal,
    onUpdate,
    context,
  );

  assert.deepEqual(result, expected);
  assert.deepEqual(calls, [
    ["call-1", { query: "Pi coding agent" }, signal, onUpdate, context],
  ]);
});

test("routes check, fetch, and get shorthands to their upstream tools", async () => {
  const cases = [
    ["check", "source_check", "Claim to verify", { claim: "Claim to verify" }],
    ["fetch", "fetch_content", "https://example.com", { url: "https://example.com" }],
    ["get", "get_search_content", "response-7", { responseId: "response-7" }],
  ];

  for (const [op, toolName, input, expectedParams] of cases) {
    const calls = [];
    const upstream = (pi) => {
      pi.registerTool({
        name: toolName,
        async execute(...args) {
          calls.push(args);
          return { content: [{ type: "text", text: `${op} result` }] };
        },
      });
    };
    const pi = createPi();
    createWebAccessFacade(upstream)(pi);

    await facadeTool(pi).execute(
      `call-${op}`,
      { op, input },
      undefined,
      undefined,
      { cwd: "C:/work" },
    );

    assert.deepEqual(calls[0][1], expectedParams);
  }
});

test("advanced JSON input is forwarded as the original parameter object", async () => {
  const calls = [];
  const upstream = (pi) => {
    pi.registerTool({
      name: "fetch_content",
      async execute(...args) {
        calls.push(args);
        return { content: [{ type: "text", text: "batch result" }] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);

  await facadeTool(pi).execute(
    "call-json",
    {
      op: "fetch",
      input: JSON.stringify({
        urls: ["https://example.com/a", "https://example.com/b"],
        mode: "raw",
      }),
    },
    undefined,
    undefined,
    { cwd: "C:/work" },
  );

  assert.deepEqual(calls[0][1], {
    urls: ["https://example.com/a", "https://example.com/b"],
    mode: "raw",
  });
});

test("help returns an upstream operation schema without executing it", async () => {
  let executions = 0;
  const upstream = (pi) => {
    pi.registerTool({
      name: "fetch_content",
      description: "Fetch full content",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          forceClone: { type: "boolean" },
        },
      },
      async execute() {
        executions += 1;
        return { content: [] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);

  const result = await facadeTool(pi).execute(
    "call-help",
    { op: "help", input: "fetch" },
    undefined,
    undefined,
    { cwd: "C:/work" },
  );

  assert.equal(executions, 0);
  assert.match(result.content[0].text, /fetch_content/);
  assert.match(result.content[0].text, /forceClone/);
});

test("invalid advanced JSON fails clearly before upstream execution", async () => {
  let executions = 0;
  const upstream = (pi) => {
    pi.registerTool({
      name: "web_search",
      async execute() {
        executions += 1;
        return { content: [] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);

  await assert.rejects(
    facadeTool(pi).execute(
      "call-invalid",
      { op: "search", input: "{not valid JSON}" },
      undefined,
      undefined,
      { cwd: "C:/work" },
    ),
    /web_access input is invalid JSON/,
  );
  assert.equal(executions, 0);
});

test("fetch on nonexistent local PDF fails with clear error", async () => {
  const pi = createPi();
  createWebAccessFacade(() => {})(pi);

  await assert.rejects(
    facadeTool(pi).execute(
      "call-nonexistent-pdf",
      { op: "fetch", input: "./nonexistent-test-file-12345.pdf" },
      undefined,
      undefined,
      { cwd: "C:/work" },
    ),
    /File not found/,
  );
});

test("fetch on local PDF with raw mode returns unsupported content type", async () => {
  const pi = createPi();
  createWebAccessFacade(() => {})(pi);

  const result = await facadeTool(pi).execute(
    "call-raw-pdf",
    {
      op: "fetch",
      input: JSON.stringify({
        url: fixturePath,
        mode: "raw",
      }),
    },
    undefined,
    undefined,
    { cwd: "C:/work" },
  );

  assert.match(result.content[0].text, /Unsupported content type in raw mode/);
});

test("fetch on valid local PDF extracts markdown directly", async () => {
  const pi = createPi();
  createWebAccessFacade(() => {})(pi);

  const result = await facadeTool(pi).execute(
    "call-local-pdf",
    { op: "fetch", input: fixturePath },
    undefined,
    undefined,
    { cwd: "C:/work" },
  );

  assert.match(result.content[0].text, /PDF extracted and saved to:/);
  for (let page = 1; page <= 5; page++) assert.match(result.content[0].text, new RegExp(`Page ${page}\\b`));
  assert.equal(result.details.totalChars > 0, true);
});

test("provider-facing facade metadata stays within the context budget", () => {
  const pi = createPi();
  extension(pi);
  const tool = facadeTool(pi);
  const providerMetadata = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    promptSnippet: tool.promptSnippet,
    promptGuidelines: tool.promptGuidelines,
  });

  assert.ok(
    providerMetadata.length <= 700,
    `web_access metadata grew to ${providerMetadata.length} characters`,
  );
});

test("drops upstream web_enable and never lets upstream change active tools", async () => {
  const activeCalls = [];
  const upstream = (pi) => {
    pi.registerTool({ name: "web_search", async execute() { return { content: [] }; } });
    pi.registerTool({ name: "web_enable", async execute() { return { content: [] }; } });
    pi.on("session_start", () => pi.setActiveTools(["web_enable"]));
  };
  const pi = createPi();
  pi.setActiveTools = (names) => activeCalls.push(names);
  createWebAccessFacade(upstream)(pi);
  for (const handler of pi.handlers.get("session_start") ?? []) await handler({}, {});

  assert.deepEqual(pi.tools.map((tool) => tool.name), ["web_access"]);
  assert.deepEqual(activeCalls, []);
  const help = await facadeTool(pi).execute("help", { op: "help", input: "" });
  assert.doesNotMatch(help.content[0].text, /web_enable/);
});

test("applies upstream prepareArguments before execution", async () => {
  const calls = [];
  const upstream = (pi) => {
    pi.registerTool({
      name: "web_search",
      prepareArguments: (args) => ({ ...args, queries: JSON.parse(args.queries) }),
      async execute(_callId, params) {
        calls.push(params);
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  await facadeTool(pi).execute("call-prep", { op: "search", input: '{"queries":"[\\"alpha\\"]"}' });
  assert.deepEqual(calls, [{ queries: ["alpha"] }]);

  // The real pinned upstream still restores stringified arrays through this hook.
  const { default: realUpstream } = await jiti.import("pi-web-access/index.ts");
  const real = createPi();
  realUpstream(real);
  const search = real.tools.find((tool) => tool.name === "web_search");
  assert.deepEqual(search.prepareArguments({ queries: '["alpha"]' }), { queries: ["alpha"] });
});

test("rewrites upstream retrieval hints to the facade call", async () => {
  const upstream = (pi) => {
    pi.registerTool({
      name: "fetch_content",
      async execute() {
        return {
          content: [
            { type: "text", text: 'Use get_search_content({ responseId: "r-1", urlIndex: 0, offset: 0, limit: 30000 }) for the next slice. Enable get_search_content to retrieve more.' },
            { type: "image", data: "x" },
          ],
          details: { responseId: "r-1" },
        };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  const result = await facadeTool(pi).execute("call-hint", { op: "fetch", input: "https://example.com" });
  assert.equal(result.content[0].text,
    'Use web_access({ op: "get", input: \'{"responseId":"r-1","urlIndex":0,"offset":0,"limit":30000}\' }) for the next slice. Enable web_access op "get" to retrieve more.');
  assert.deepEqual(result.content[1], { type: "image", data: "x" });
  assert.deepEqual(result.details, { responseId: "r-1" });
});

test("rewrites upstream 404 guidance to facade operations", async () => {
  const upstream = (pi) => {
    pi.registerTool({
      name: "fetch_content",
      async execute() {
        return { content: [{ type: "text", text: "Error: HTTP 404\n\nThe page may have moved or been renamed. Use web_search to find the current URL, then retry fetch_content with it." }] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  const result = await facadeTool(pi).execute("call-404", { op: "fetch", input: "https://example.com/gone" });
  assert.equal(result.content[0].text,
    'Error: HTTP 404\n\nThe page may have moved or been renamed. Use web_access op "search" to find the current URL, then retry web_access op "fetch" with it.');
});

test("leaves fetched page text that mentions the upstream tool unchanged", async () => {
  const page = 'The get_search_content tool returns slices.\nget_search_content({ responseId: id })\nget_search_content({ responseId: "x", query: "a, b" })';
  const upstream = (pi) => {
    pi.registerTool({
      name: "fetch_content",
      async execute() {
        return { content: [{ type: "text", text: `${page}\n\n---\nUse get_search_content({ responseId: "r-2", urlIndex: 0, offset: 10 }) for the next slice.` }] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  const result = await facadeTool(pi).execute("call-page", { op: "fetch", input: "https://example.com" });
  assert.equal(result.content[0].text,
    `${page}\n\n---\nUse web_access({ op: "get", input: '{"responseId":"r-2","urlIndex":0,"offset":10}' }) for the next slice.`);
});

const { Value } = await jiti.import("typebox/value");

function prepare(args) {
  const pi = createPi();
  createWebAccessFacade((p) => p.registerTool({ name: "web_search", async execute() { return { content: [] }; } }))(pi);
  const tool = facadeTool(pi);
  return { prepared: tool.prepareArguments(args), valid: (value) => Value.Check(tool.parameters, value) };
}

test("prepareArguments infers an omitted op only from unambiguous fields", () => {
  const cases = [
    [{ responseId: "r-1" }, "get"],
    [{ responseId: "r-1", query: "q", url: "https://a.test" }, "get"],
    [{ url: "https://a.test" }, "fetch"],
    [{ urls: ["https://a.test"] }, "fetch"],
    [{ claim: "x" }, "check"],
    [{ claim: "x", queries: ["y"] }, "check"],
    [{ query: "x" }, "search"],
    [{ queries: ["x"] }, "search"],
    [{ input: '{"urls":["https://a.test"]}' }, "fetch"],
    [{ input: "https://a.test/page" }, "fetch"],
    [{ input: String.raw`C:\docs\paper.PDF` }, "fetch"],
    [{ input: "./paper.pdf" }, "fetch"],
    [{ input: "latest Pi release notes" }, "search"],
    [{ input: "see paper.pdf" }, "search"],
    [{ input: { claim: "x" } }, "check"],
  ];
  for (const [args, op] of cases) {
    const { prepared, valid } = prepare(args);
    assert.equal(prepared.op, op, JSON.stringify(args));
    assert.ok(valid(prepared), JSON.stringify(prepared));
  }

  // Ambiguous or empty signals stay as-is and still fail schema validation.
  const ambiguous = [
    { url: "https://a.test", query: "x" },
    { claim: "x", url: "https://a.test" },
    { query: "x", input: "y" },
    { input: "https://a.test", query: "x" },
    { input: "" },
    { input: "{not json" },
    { input: '{"mode":"raw"}' },
    {},
  ];
  for (const args of ambiguous) {
    const { prepared, valid } = prepare(args);
    assert.deepEqual(prepared, args);
    assert.ok(!valid(prepared), JSON.stringify(args));
  }
});

test("prepareArguments stringifies an object input and keeps explicit values", () => {
  const { prepared, valid } = prepare({ op: "fetch", input: { urls: ["https://a.test"], mode: "raw" } });
  assert.deepEqual(prepared, { op: "fetch", input: '{"urls":["https://a.test"],"mode":"raw"}' });
  assert.ok(valid(prepared));

  const explicit = { op: "fetch", input: "latest news" };
  assert.deepEqual(prepare(explicit).prepared, explicit);
  const help = { op: "help", query: "x", input: "search" };
  assert.deepEqual(prepare(help).prepared, help);
  const unknown = { op: "bogus", query: "x" };
  assert.deepEqual(prepare(unknown).prepared, unknown);
  assert.ok(!prepare(unknown).valid(unknown));
  assert.equal(prepare(null).prepared, null);
  assert.deepEqual(prepare(["x"]).prepared, ["x"]);
});

test("prepareArguments moves top-level upstream fields into input", () => {
  const cases = [
    [{ op: "search", query: "x", numResults: 5 }, { query: "x", numResults: 5 }],
    [{ op: "fetch", url: "https://a.test" }, { url: "https://a.test" }],
    [{ query: "x", numResults: 5 }, { query: "x", numResults: 5 }],
    // JSON input merges with top-level fields that agree with it.
    [{ op: "search", input: '{"queries":["a"]}', numResults: 3 }, { queries: ["a"], numResults: 3 }],
    [{ op: "search", input: '{"numResults":2}', numResults: 2, includeContent: true }, { numResults: 2, includeContent: true }],
    // A plain string input becomes the primary field.
    [{ op: "search", input: "x", numResults: 5 }, { query: "x", numResults: 5 }],
    [{ op: "search", input: "x", query: "x", numResults: 5 }, { query: "x", numResults: 5 }],
    [{ op: "check", input: "claim text", fetchContent: true }, { claim: "claim text", fetchContent: true }],
    [{ op: "get", input: "r-1", findText: "needle" }, { responseId: "r-1", findText: "needle" }],
  ];
  for (const [args, expected] of cases) {
    const { prepared, valid } = prepare(args);
    assert.equal(prepared.op, args.op ?? "search");
    assert.deepEqual(Object.keys(prepared).sort(), ["input", "op"]);
    assert.deepEqual(JSON.parse(prepared.input), expected, JSON.stringify(args));
    assert.ok(valid(prepared));
  }

  // A plain string input conflicting with the top-level primary field is left untouched.
  const conflict = { op: "search", input: "x", query: "y", numResults: 5 };
  assert.deepEqual(prepare(conflict).prepared, conflict);
  // So is a top-level field disagreeing with JSON input (execute then rejects it).
  const jsonConflict = { op: "search", input: '{"numResults":2}', numResults: 9 };
  assert.deepEqual(prepare(jsonConflict).prepared, jsonConflict);
  const inferredConflict = { input: '{"query":"a"}', query: "b" };
  assert.deepEqual(prepare(inferredConflict).prepared, { ...inferredConflict, op: "search" });

  // Pure and idempotent.
  const original = { op: "search", query: "x", numResults: 5 };
  const snapshot = structuredClone(original);
  const { prepared } = prepare(original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(prepare(prepared).prepared, prepared);
});

test("prepared top-level fields reach the upstream tool and local PDFs", async () => {
  const calls = [];
  const upstream = (pi) => {
    pi.registerTool({
      name: "web_search",
      prepareArguments: (args) => ({ ...args, queries: args.queries && JSON.parse(args.queries) }),
      async execute(_callId, params) {
        calls.push(params);
        return { content: [{ type: "text", text: "ok" }] };
      },
    });
  };
  const pi = createPi();
  createWebAccessFacade(upstream)(pi);
  const tool = facadeTool(pi);
  await tool.execute("call-top", tool.prepareArguments({ query: "x", numResults: 5 }));
  assert.deepEqual(calls[0], { query: "x", numResults: 5, queries: undefined });

  const result = await tool.execute("call-pdf", tool.prepareArguments({ url: fixturePath, mode: "raw" }));
  assert.match(result.content[0].text, /Unsupported content type in raw mode/);
  const pdf = await tool.execute("call-pdf-2", tool.prepareArguments({ input: fixturePath }));
  assert.match(pdf.content[0].text, /Page 5\b/);

  // A top-level field that disagrees with input is rejected, never silently dropped.
  for (const args of [{ op: "search", input: '{"numResults":2}', numResults: 9 }, { op: "search", input: "x", query: "y" }]) {
    await assert.rejects(tool.execute("call-conflict", tool.prepareArguments(args)), /top-level \w+ disagrees with input/);
  }
  assert.equal(calls.length, 1);
});
