import { type AgentEvent, agentLoop as previousAgentLoop } from "./s50_cognitive_capstone.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};
export type RpcResponse = {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
};
export type McpContext = { initialized: boolean; sessionId: string; canceled: Set<string> };

export function createMcpContext(sessionId: string = crypto.randomUUID()): McpContext {
  return { initialized: false, sessionId, canceled: new Set() };
}

export async function dispatchMcp(request: RpcRequest, context: McpContext): Promise<RpcResponse> {
  try {
    if (request.method === "initialize") {
      context.initialized = true;
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true },
            prompts: {},
          },
          serverInfo: { name: "s51-stdio-server", version: "1.0.0" },
        },
      };
    }
    if (request.method === "notifications/initialized") {
      return { jsonrpc: "2.0", id: request.id, result: {} };
    }
    if (!context.initialized) throw new Error("MCP session is not initialized");
    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: [{ name: "echo", inputSchema: { type: "object" } }] },
      };
    }
    if (request.method === "resources/list") {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { resources: [{ uri: "lesson://state", name: "lesson state" }] },
      };
    }
    if (request.method === "resources/read") {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { contents: [{ uri: String(request.params?.uri), text: "stdio resource" }] },
      };
    }
    if (request.method === "tools/call") {
      const callId = String(request.id ?? "");
      if (context.canceled.has(callId)) throw new Error("request canceled");
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(request.params?.arguments ?? {}) }],
        },
      };
    }
    if (request.method === "notifications/cancelled") {
      context.canceled.add(String(request.params?.requestId ?? ""));
      return { jsonrpc: "2.0", id: request.id, result: {} };
    }
    throw new Error(`method not found: ${request.method}`);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32_600, message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function runStdioSession(lines: AsyncIterable<string>): Promise<string[]> {
  const context = createMcpContext("stdio-lesson");
  const responses: string[] = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    responses.push(JSON.stringify(await dispatchMcp(JSON.parse(line) as RpcRequest, context)));
  }
  return responses;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_stdio_runtime_demo",
    description: "Execute an actual line-oriented MCP JSON-RPC session in memory",
    parameters: {
      type: "object",
      properties: { requests: { type: "array" } },
      required: ["requests"],
    },
  },
};
registerTool(definition, async (input) => {
  const requests = Array.isArray(input.requests) ? input.requests : [];
  async function* lines() {
    for (const request of requests) yield JSON.stringify(request);
  }
  return JSON.stringify(await runStdioSession(lines()));
});
registerSystemPromptSection({
  id: "s51-mcp-stdio-runtime",
  title: "MCP STDIO runtime",
  priority: 32,
  content:
    "A real MCP session is line-oriented JSON-RPC with initialization, capability negotiation, notifications, cancellation, bounded output, and clean process shutdown. Keep protocol dispatch independent from the transport loop.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    await runStdioSession((async function* () {
      yield JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" });
    })()),
  );
  const query = prompt("s51 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
