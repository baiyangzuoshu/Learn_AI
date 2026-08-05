import { type AgentEvent, agentLoop as previousAgentLoop } from "./s60_release_chaos.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};
export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
};

export type McpServer = (request: JsonRpcRequest) => Promise<JsonRpcResponse>;

export class McpInteropClient {
  private initialized = false;
  private sequence = 0;
  constructor(private readonly server: McpServer, private readonly maxBytes = 32_000) {}

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = `mcp-${++this.sequence}`;
    const response = await this.server({ jsonrpc: "2.0", id, method, params });
    const encoded = JSON.stringify(response);
    if (encoded.length > this.maxBytes) throw new Error("MCP response exceeds output budget");
    if (response.error) throw new Error(`${response.error.code}: ${response.error.message}`);
    return response.result;
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2025-03-26",
      clientInfo: { name: "s61-client", version: "1.0.0" },
    });
    this.initialized = true;
    await this.request("notifications/initialized");
    return result;
  }

  async listTools() {
    if (!this.initialized) await this.initialize();
    return await this.request("tools/list");
  }

  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!this.initialized) await this.initialize();
    const result = await this.request("tools/call", { name, arguments: args });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return result;
  }
}

export function createInteropServer(): McpServer {
  let initialized = false;
  return async (request) => {
    if (request.method === "initialize") {
      initialized = true;
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: { listChanged: true }, resources: { subscribe: true } },
          serverInfo: { name: "s61-server", version: "1.0.0" },
        },
      };
    }
    if (request.method === "notifications/initialized") return { jsonrpc: "2.0", id: request.id };
    if (!initialized) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32001, message: "not initialized" },
      };
    }
    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: [{ name: "echo", inputSchema: { type: "object" } }] },
      };
    }
    if (request.method === "tools/call") {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { content: [{ type: "text", text: String(request.params?.arguments ?? "") }] },
      };
    }
    return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "method not found" } };
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_interop_harness",
    description: "Negotiate capabilities and call a bounded MCP server through a client contract",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const client = new McpInteropClient(createInteropServer());
  const capabilities = await client.initialize();
  const tools = await client.listTools();
  const result = await client.callTool("echo", { text: String(input.text) });
  return JSON.stringify({ capabilities, tools, result });
});
registerSystemPromptSection({
  id: "s61-mcp-interop",
  title: "MCP interoperability harness",
  priority: 42,
  content:
    "Treat MCP as a negotiated client/server contract. Initialize before discovery, bound every response, propagate cancellation, and keep transport-specific code outside protocol logic.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const client = new McpInteropClient(createInteropServer());
  console.log(await client.callTool("echo", { text: "hello" }));
  const query = prompt("s61 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
