import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "./s25_planner_executor_verifier.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type McpRequest = { id: string; method: string; params?: Record<string, unknown> };
export interface McpSession {
  request(message: McpRequest, signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export class McpManager {
  private sessions = new Map<string, McpSession>();
  constructor(private readonly create: (id: string) => Promise<McpSession>) {}
  async call(
    server: string,
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    let session = this.sessions.get(server);
    if (!session) {
      session = await this.create(server);
      await session.request({
        id: crypto.randomUUID(),
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      }, signal);
      this.sessions.set(server, session);
    }
    return await session.request({ id: crypto.randomUUID(), method, params }, signal);
  }
  async shutdown() {
    await Promise.all([...this.sessions.values()].map((session) => session.close()));
    this.sessions.clear();
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_session",
    description: "Negotiate, reuse, cancel, and close an MCP HTTP, SSE, or STDIO session",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const manager = new McpManager(async () => ({
    request: async (request) => ({ ...request, result: input.text }),
    close: async () => {},
  }));
  const result = await manager.call("lesson", "tools/call", { name: "echo" });
  await manager.shutdown();
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s26-mcp",
  title: "MCP protocol and process management",
  priority: 37,
  content:
    "MCP is a negotiated session, not an untrusted URL. Support discovery, typed calls, STDIO process supervision, transport cancellation, HTTPS policy, bounded output, and clean shutdown.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
