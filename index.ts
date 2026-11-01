// pi-web-access-lean: one provider-facing facade over the full pi-web-access runtime.
// Detailed operation schemas stay local and are disclosed only through `help`.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import webAccess from "pi-web-access/index.ts";
import { extractPDFToMarkdown, loadPDFConfig } from "pi-web-access/pdf-extract.ts";
import { Type } from "typebox";
const COLLAPSED_DISPLAY_SERVICE = Symbol.for(
  "@local/pi-collapsed-tools.display-service.v1",
);

type CollapsedDisplayTool = { name: string };
type CollapsedDisplayService = {
  readonly version: 1;
  decorate<T extends CollapsedDisplayTool>(tool: T): T;
};

function decorateWithCollapsedDisplay<T extends CollapsedDisplayTool>(tool: T): T {
  const services = globalThis as unknown as Record<PropertyKey, unknown>;
  const candidate = services[COLLAPSED_DISPLAY_SERVICE];
  if (!candidate || typeof candidate !== "object") return tool;
  const service = candidate as Partial<CollapsedDisplayService>;
  return service.version === 1 && typeof service.decorate === "function"
    ? service.decorate(tool)
    : tool;
}

type CapturedTool = ToolDefinition<any, any, any>;
type UpstreamExtension = (pi: ExtensionAPI) => void;

const ROUTES = {
  search: { toolName: "web_search", inputName: "query" },
  check: { toolName: "source_check", inputName: "claim" },
  fetch: { toolName: "fetch_content", inputName: "url" },
  get: { toolName: "get_search_content", inputName: "responseId" },
} as const;

type Operation = keyof typeof ROUTES;
type FacadeOperation = Operation | "help";

const FACADE_PARAMETERS = Type.Object({
  op: Type.Unsafe<FacadeOperation>({
    type: "string",
    enum: ["search", "check", "fetch", "get", "help"],
  }),
  input: Type.Optional(Type.String({
    description: "Main query, claim, URL, local PDF path, or responseId; use a JSON object string for advanced parameters",
  })),
});

// Upstream 0.31+ hides its tools behind `web_enable` and toggles the active tool set,
// which changes the tool list mid-session and breaks prompt caching. The facade is
// always active, so drop the loader and never let upstream change active tools.
const UPSTREAM_LOADER = "web_enable";

function capturePi(
  pi: ExtensionAPI,
  tools: Map<string, CapturedTool>,
): ExtensionAPI {
  return new Proxy(pi, {
    get(target, property, receiver) {
      if (property === "registerTool") {
        return (tool: CapturedTool) => {
          if (tool.name !== UPSTREAM_LOADER) tools.set(tool.name, tool);
        };
      }
      if (property === "setActiveTools") return () => undefined;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function parseInput(input: string, inputName: string): Record<string, unknown> {
  if (!input.trimStart().startsWith("{")) return { [inputName]: input };

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`web_access input is invalid JSON: ${reason}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("web_access advanced input must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

// Fields that identify an operation. `also` lists fields the upstream tool accepts besides its own
// (get_search_content takes query/url; source_check takes queries), so they do not make it ambiguous.
const SIGNALS: Record<Operation, { own: string[]; also: string[] }> = {
  get: { own: ["responseId"], also: ["query", "url"] },
  check: { own: ["claim"], also: ["queries"] },
  fetch: { own: ["url", "urls"], also: [] },
  search: { own: ["query", "queries"], also: [] },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function inferOpFromFields(fields: Record<string, unknown>): Operation | undefined {
  const ops = Object.keys(SIGNALS) as Operation[];
  const known = new Set(ops.flatMap((op) => SIGNALS[op].own));
  const present = Object.keys(fields).filter((key) => known.has(key));
  const matches = ops.filter((op) => {
    const { own, also } = SIGNALS[op];
    return present.some((key) => own.includes(key))
      && present.every((key) => own.includes(key) || also.includes(key));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

// Pure string check, no filesystem access: execute still validates that a PDF exists.
function inferOpFromText(text: string): Operation {
  const isUrl = /^https?:\/\/\S+$/i.test(text);
  return isUrl || (isLocalPath(text) && extname(text).toLowerCase() === ".pdf") ? "fetch" : "search";
}

// Runs before schema validation. Models often omit `op`, pass `input` as an object, or put
// upstream fields at the top level; fix only what is unambiguous and leave the rest to validation.
function prepareFacadeArguments(args: unknown): any {
  if (!isRecord(args)) return args;
  const { op, input: rawInput, ...extra } = args;
  if (rawInput !== undefined && typeof rawInput !== "string" && !isRecord(rawInput)) return args;
  const input = isRecord(rawInput) ? JSON.stringify(rawInput) : rawInput;
  const base = input === rawInput ? args : { ...args, input };
  if (op === "help" || (op !== undefined && !(typeof op === "string" && Object.hasOwn(ROUTES, op)))) {
    return base;
  }

  const text = input?.trim() ?? "";
  const isJson = text.startsWith("{");
  const json = isJson ? parseJsonObject(text) : undefined;
  if (isJson && !json) return base; // invalid JSON: execute reports it
  const hasExtra = Object.keys(extra).length > 0;

  let route = op as Operation | undefined;
  if (route === undefined) {
    route = text && !json
      ? (hasExtra ? undefined : inferOpFromText(text))
      : inferOpFromFields({ ...json, ...extra });
    if (route === undefined) return base;
  }
  if (!hasExtra) return op === undefined ? { ...base, op: route } : base;

  const name = ROUTES[route].inputName;
  let merged: Record<string, unknown>;
  if (!text) merged = extra;
  else if (json) {
    // A top-level field that disagrees with input is not resolved silently: leave it for validation.
    if (Object.keys(extra).some((key) => Object.hasOwn(json, key) && !isDeepStrictEqual(json[key], extra[key]))) {
      return op === undefined ? { ...base, op: route } : base;
    }
    merged = { ...json, ...extra };
  }
  else if (name in extra && extra[name] !== input) return op === undefined ? { ...base, op: route } : base;
  else merged = { ...extra, [name]: input };
  return { op: route, input: JSON.stringify(merged) };
}

// Upstream result hints name its hidden tools, e.g.
// get_search_content({ responseId: "id", urlIndex: 0 }); point them at the facade.
// Only exact upstream hint forms are rewritten so fetched page text stays intact.
const RETRIEVAL_TOOL = ROUTES.get.toolName;
const GET_CALL = 'web_access op "get"';
const RETRIEVAL_CALL = new RegExp(`\\b${RETRIEVAL_TOOL}\\(\\{([^{}]*)\\}\\)`, "g");
const HINT_ARG = /^\s*(responseId|urlIndex|queryIndex|offset|limit):\s*("[\w-]*"|\d+)\s*$/;
const RETRIEVAL_PHRASES: Array<[RegExp, string]> = [
  [new RegExp(`\\bEnable ${RETRIEVAL_TOOL} to retrieve\\b`, "g"), `Enable ${GET_CALL} to retrieve`],
  [new RegExp(`\\buse ${RETRIEVAL_TOOL} findText or offset\\b`, "g"), `use ${GET_CALL} with findText or offset`],
  [new RegExp(`\\buse \`${RETRIEVAL_TOOL}\` with\\b`, "g"), `use ${GET_CALL} with`],
  [new RegExp(`\\bretrieval with ${RETRIEVAL_TOOL}\\b`, "g"), `retrieval with ${GET_CALL}`],
  // HTTP 404/410 guidance from upstream extract.ts.
  [new RegExp(`\\bUse ${ROUTES.search.toolName} to find the current URL\\b`, "g"), 'Use web_access op "search" to find the current URL'],
  [new RegExp(`\\bthen retry ${ROUTES.fetch.toolName} with it\\b`, "g"), 'then retry web_access op "fetch" with it'],
];

function facadeGetCall(match: string, body: string): string {
  const args: Record<string, unknown> = {};
  for (const part of body.split(",")) {
    const pair = part.match(HINT_ARG);
    if (!pair) return match;
    args[pair[1]] = JSON.parse(pair[2]);
  }
  return `web_access({ op: "get", input: '${JSON.stringify(args)}' })`;
}

function rewriteRetrievalHints(text: string): string {
  let rewritten = text.replace(RETRIEVAL_CALL, facadeGetCall);
  for (const [pattern, replacement] of RETRIEVAL_PHRASES) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  return rewritten;
}

function withFacadeHints<T>(result: T): T {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return result;
  return {
    ...result,
    content: content.map((entry) =>
      entry?.type === "text" && typeof entry.text === "string"
        ? { ...entry, text: rewriteRetrievalHints(entry.text) }
        : entry),
  };
}

function helpResult(
  operation: string,
  tools: Map<string, CapturedTool>,
) {
  const route = ROUTES[operation as Operation];
  if (!route) {
    return {
      content: [{
        type: "text" as const,
        text: "Operations: search(query), check(claim), fetch(URL or local PDF), get(responseId). For advanced parameters, call help with input set to one operation name.",
      }],
      details: { operation: "help" },
    };
  }

  const tool = tools.get(route.toolName);
  if (!tool) throw new Error(`web_access could not find upstream tool: ${route.toolName}`);
  const text = [
    `${operation} routes to ${route.toolName}`,
    tool.description,
    "Advanced input must be a JSON object string matching this schema:",
    JSON.stringify(tool.parameters, null, 2),
  ].filter(Boolean).join("\n\n");
  return {
    content: [{ type: "text" as const, text }],
    details: { operation, toolName: route.toolName },
  };
}
interface LocalPDFInfo {
  absolutePath: string;
  sizeBytes: number;
}

function isLocalPath(trimmed: string): boolean {
  return trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith(".\\") ||
    trimmed.startsWith("..\\") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("\\\\") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed);
}

function resolveLocalPDF(input: string): LocalPDFInfo | null {
  const trimmed = input.trim();
  if (!isLocalPath(trimmed)) return null;

  let filePath = trimmed;
  if (trimmed.startsWith("file:")) {
    try {
      filePath = fileURLToPath(trimmed);
    } catch {
      return null;
    }
  }

  if (extname(filePath).toLowerCase() !== ".pdf") return null;

  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${absolutePath}`);
  }
  return { absolutePath, sizeBytes: stat.size };
}

async function executeLocalPDF(
  url: string,
  localPdf: LocalPDFInfo,
  parsed: Record<string, unknown>,
  signal?: AbortSignal,
) {
  if (parsed.mode === "raw") {
    return {
      content: [{ type: "text" as const, text: "Error: Unsupported content type in raw mode: application/pdf" }],
      details: { error: "Unsupported content type in raw mode: application/pdf" },
    };
  }

  const pdfConfig = loadPDFConfig();
  if (!pdfConfig.enabled) {
    return {
      content: [{ type: "text" as const, text: "Error: PDF extraction is disabled by pdf.enabled" }],
      details: { error: "PDF extraction is disabled by pdf.enabled" },
    };
  }

  const maxBytes = pdfConfig.maxSizeMB * 1024 * 1024;
  if (localPdf.sizeBytes > maxBytes) {
    const errorMsg = `PDF exceeds configured pdf.maxSizeMB limit (${pdfConfig.maxSizeMB} MB)`;
    return {
      content: [{ type: "text" as const, text: `Error: ${errorMsg}` }],
      details: { error: errorMsg },
    };
  }

  if (signal?.aborted) {
    return {
      content: [{ type: "text" as const, text: "Error: Request was aborted." }],
      details: { error: "Request was aborted" },
    };
  }

  const fileBuffer = readFileSync(localPdf.absolutePath);
  const buffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );

  try {
    const result = await extractPDFToMarkdown(buffer, localPdf.absolutePath, { signal });
    // Same text upstream fetch_content returns for a remote PDF since 0.46.0.
    return {
      content: [{
        type: "text" as const,
        text: `PDF extracted and saved to: ${result.outputPath}\n\n${result.content}`,
      }],
      details: {
        urls: [url],
        urlCount: 1,
        successful: 1,
        totalChars: result.content.length,
        title: result.title,
        outputPath: result.outputPath,
        mode: (parsed.mode as string) ?? "readable",
        mimeType: "application/pdf",
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: PDF extraction failed: ${message}` }],
      details: { error: `PDF extraction failed: ${message}` },
    };
  }
}

export function createWebAccessFacade(
  upstream: UpstreamExtension = webAccess,
): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI): void => {
    const tools = new Map<string, CapturedTool>();
    upstream(capturePi(pi, tools));
    const facadeTool: ToolDefinition<typeof FACADE_PARAMETERS, unknown, unknown> = {
      name: "web_access",
      label: "Web Access",
      description: "Search, verify, fetch web or local PDF content, or continue results through one router. Use help for advanced parameters.",
      promptGuidelines: [
        "web_access: input is the query, claim, URL, local PDF path, or responseId for search, check, fetch, or get. Pass a JSON object string for batch or advanced parameters; use help only when fields are unclear.",
      ],
      parameters: FACADE_PARAMETERS,
      prepareArguments: prepareFacadeArguments,
      async execute(callId, params, signal, onUpdate, ctx) {
        if (params.op === "help") {
          return helpResult((params.input ?? "").trim(), tools);
        }

        // prepareArguments merges every top-level field into input except one that disagrees with it.
        const stray = Object.keys(params).filter((key) => key !== "op" && key !== "input");
        if (stray.length > 0) {
          throw new Error(`web_access: top-level ${stray.join(", ")} disagrees with input; pass each value once, inside input`);
        }
        const route = ROUTES[params.op];
        if (!route) {
          throw new Error(`web_access operation is not implemented: ${params.op}`);
        }
        const parsed = parseInput(params.input ?? "", route.inputName);
        if (params.op === "fetch" && typeof parsed.url === "string") {
          const localPdf = resolveLocalPDF(parsed.url);
          if (localPdf) {
            return executeLocalPDF(parsed.url, localPdf, parsed, signal);
          }
        }
        const tool = tools.get(route.toolName);
        if (!tool) {
          throw new Error(`web_access could not find upstream tool: ${route.toolName}`);
        }
        const args = tool.prepareArguments ? tool.prepareArguments(parsed) : parsed;
        return withFacadeHints(await tool.execute(
          callId,
          args,
          signal,
          onUpdate,
          ctx,
        ));
      },
    };
    pi.registerTool(decorateWithCollapsedDisplay(facadeTool));
  };
}

export default createWebAccessFacade();
