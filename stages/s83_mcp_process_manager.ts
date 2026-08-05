import { type AgentEvent, agentLoop as previousAgentLoop } from "./s82_provider_routing.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export interface McpProcess {
  request(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export type McpProcessFactory = (
  server: { command: string; args: string[] },
) => Promise<McpProcess>;
export class McpProcessManager {
  private readonly active = new Map<string, McpProcess>();
  constructor(private readonly factory: McpProcessFactory) {}
  async connect(id: string, server: { command: string; args: string[] }) {
    const existing = this.active.get(id);
    if (existing) return existing;
    const process = await this.factory(server);
    await process.request("initialize", { protocolVersion: "2025-03-26" });
    this.active.set(id, process);
    return process;
  }
  async call(
    id: string,
    server: { command: string; args: string[] },
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const process = await this.connect(id, server);
    return await process.request(method, params, signal);
  }
  async disconnect(id: string) {
    const process = this.active.get(id);
    if (process) {
      await process.close();
      this.active.delete(id);
    }
  }
  async shutdown() {
    for (const id of [...this.active.keys()]) await this.disconnect(id);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_process_manager",
    description:
      "Manage MCP process lifetimes, initialize sessions, propagate cancellation, and close cleanly",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const manager = new McpProcessManager(async () => ({
    request: async (method, params) => ({ method, params }),
    close: async () => {},
  }));
  const result = await manager.call("lesson", { command: "lesson-mcp", args: [] }, "tools/call", {
    name: "echo",
    arguments: { text: input.text },
  });
  await manager.shutdown();
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s83-mcp-process",
  title: "MCP process manager",
  priority: 64,
  content:
    "MCP child processes are supervised resources: initialize once, reuse sessions, pass AbortSignal to requests, cap restarts, and close every process on cancellation or shutdown.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s83 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
