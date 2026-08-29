import assert from "node:assert/strict";
import test from "node:test";
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
