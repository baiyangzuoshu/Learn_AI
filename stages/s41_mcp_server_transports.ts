import { type AgentEvent, agentLoop as previousAgentLoop } from "./s40_cognitive_workspace.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type McpTransport = "stdio" | "sse" | "streamable-http";
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

export class TeachingMcpServer {
  readonly tools = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  readonly resources = new Map<string, string>();
  readonly prompts = new Map<string, (args: Record<string, unknown>) => string>();
  constructor(readonly name: string, readonly transport: McpTransport) {}
  async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      if (request.method === "initialize") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-03-26",
            serverInfo: { name: this.name, version: "s41" },
            capabilities: { tools: {}, resources: {}, prompts: {} },
          },
        };
      }
      if (request.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { tools: [...this.tools.keys()].map((name) => ({ name })) },
        };
      }
      if (request.method === "resources/list") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { resources: [...this.resources.keys()].map((uri) => ({ uri })) },
        };
      }
      if (request.method === "prompts/list") {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { prompts: [...this.prompts.keys()].map((name) => ({ name })) },
        };
      }
      if (request.method === "tools/call") {
        const name = String(request.params?.name ?? "");
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`tool not found: ${name}`);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: await tool((request.params?.arguments ?? {}) as Record<string, unknown>),
        };
      }
      if (request.method === "resources/read") {
        const uri = String(request.params?.uri ?? "");
        if (!this.resources.has(uri)) throw new Error(`resource not found: ${uri}`);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: { contents: [{ uri, text: this.resources.get(uri) }] },
        };
      }
      if (request.method === "prompts/get") {
        const name = String(request.params?.name ?? "");
        const prompt = this.prompts.get(name);
        if (!prompt) throw new Error(`prompt not found: ${name}`);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            messages: [{
              role: "user",
              content: {
                type: "text",
                text: prompt((request.params?.arguments ?? {}) as Record<string, unknown>),
              },
            }],
          },
        };
      }
      throw new Error(`method not found: ${request.method}`);
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32_601, message: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

export function encodeSse(response: JsonRpcResponse): string {
  return `event: message\ndata: ${JSON.stringify(response)}\n\n`;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_server_protocol_demo",
    description: "Run a local teaching MCP server over a selected logical transport",
    parameters: {
      type: "object",
      properties: {
        transport: { type: "string" },
        resource: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["transport", "resource", "prompt"],
    },
  },
};
registerTool(definition, async (input) => {
  const transport = String(input.transport) as McpTransport;
  if (!["stdio", "sse", "streamable-http"].includes(transport)) {
    throw new Error("unsupported transport");
  }
  const server = new TeachingMcpServer("lesson-server", transport);
  server.resources.set(String(input.resource), "resource content");
  server.prompts.set("explain", () => String(input.prompt));
  server.tools.set("echo", async (args) => args);
  const initialized = await server.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const listed = await server.dispatch({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  return JSON.stringify({ transport, initialized, listed, sseFrame: encodeSse(listed) });
});
registerSystemPromptSection({
  id: "s41-mcp-server-transports",
  title: "MCP servers and transports",
  priority: 22,
  content:
    "MCP servers expose tools, resources, and prompts through a negotiated JSON-RPC lifecycle. Keep transport concerns separate from capability dispatch; validate initialization, IDs, errors, and cancellation for STDIO, SSE, and streamable HTTP.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const server = new TeachingMcpServer("demo", "stdio");
  console.log(await server.dispatch({ jsonrpc: "2.0", id: 1, method: "initialize" }));
  const query = prompt("s41 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
