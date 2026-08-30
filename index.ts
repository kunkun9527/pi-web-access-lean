// pi-web-access-lean: one provider-facing facade over the full pi-web-access runtime.
// Detailed operation schemas stay local and are disclosed only through `help`.
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import webAccess from "pi-web-access/index.ts";
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
    description: "Main query, claim, URL, or responseId; use a JSON object string for advanced parameters",
  })),
});

function capturePi(
  pi: ExtensionAPI,
  tools: Map<string, CapturedTool>,
): ExtensionAPI {
  return new Proxy(pi, {
    get(target, property, receiver) {
      if (property === "registerTool") {
        return (tool: CapturedTool) => tools.set(tool.name, tool);
      }
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

function helpResult(
  operation: string,
  tools: Map<string, CapturedTool>,
) {
  const route = ROUTES[operation as Operation];
  if (!route) {
    return {
      content: [{
        type: "text" as const,
        text: "Operations: search(query), check(claim), fetch(URL), get(responseId). For advanced parameters, call help with input set to one operation name.",
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

export function createWebAccessFacade(
  upstream: UpstreamExtension = webAccess,
): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI): void => {
    const tools = new Map<string, CapturedTool>();
    upstream(capturePi(pi, tools));
    const facadeTool: ToolDefinition<typeof FACADE_PARAMETERS, unknown, unknown> = {
      name: "web_access",
      label: "Web Access",
      description: "Search, verify, fetch, or continue web content through one local router. Use help for advanced parameters.",
      promptGuidelines: [
        "web_access input is the query, claim, URL, or responseId for search, check, fetch, or get. Pass a JSON object string for batch or advanced parameters; use help only when fields are unclear.",
      ],
      parameters: FACADE_PARAMETERS,
      async execute(callId, params, signal, onUpdate, ctx) {
        if (params.op === "help") {
          return helpResult((params.input ?? "").trim(), tools);
        }

        const route = ROUTES[params.op];
        if (!route) {
          throw new Error(`web_access operation is not implemented: ${params.op}`);
        }
        const tool = tools.get(route.toolName);
        if (!tool) {
          throw new Error(`web_access could not find upstream tool: ${route.toolName}`);
        }
        return tool.execute(
          callId,
          parseInput(params.input ?? "", route.inputName),
          signal,
          onUpdate,
          ctx,
        );
      },
    };
    pi.registerTool(decorateWithCollapsedDisplay(facadeTool));
  };
}

export default createWebAccessFacade();
