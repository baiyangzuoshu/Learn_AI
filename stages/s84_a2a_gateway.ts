import { type AgentEvent, agentLoop as previousAgentLoop } from "./s83_mcp_process_manager.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type GatewayRequest = {
  caller: string;
  tenant: string;
  idempotencyKey: string;
  task: string;
  traceId: string;
};
export type GatewayTask = GatewayRequest & {
  id: string;
  state: "accepted" | "running" | "completed" | "failed";
  artifacts: string[];
};
export interface GatewayStore {
  get(key: string): Promise<GatewayTask | undefined>;
  save(task: GatewayTask): Promise<void>;
}
export class A2AGateway {
  constructor(
    private readonly store: GatewayStore,
    private readonly authorize: (caller: string, tenant: string) => boolean,
  ) {}
  async submit(request: GatewayRequest) {
    if (!this.authorize(request.caller, request.tenant)) {
      throw new Error("A2A gateway authorization denied");
    }
    const existing = await this.store.get(`${request.tenant}:${request.idempotencyKey}`);
    if (existing) return existing;
    const task: GatewayTask = {
      ...request,
      id: `gateway-${crypto.randomUUID().slice(0, 8)}`,
      state: "accepted",
      artifacts: [],
    };
    await this.store.save(task);
    return task;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "a2a_gateway",
    description:
      "Accept an authenticated, tenant-scoped, idempotent A2A task with trace propagation",
    parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
  },
};
registerTool(definition, async (input) => {
  const values = new Map<string, GatewayTask>();
  const gateway = new A2AGateway({
    get: async (key) => values.get(key),
    save: async (task) => {
      values.set(`${task.tenant}:${task.idempotencyKey}`, task);
    },
  }, () => true);
  return JSON.stringify(
    await gateway.submit({
      caller: "agent-a",
      tenant: "lesson",
      idempotencyKey: "k1",
      task: String(input.task),
      traceId: crypto.randomUUID(),
    }),
  );
});
registerSystemPromptSection({
  id: "s84-a2a-gateway",
  title: "A2A gateway",
  priority: 65,
  content:
    "A2A communication crosses a gateway that authenticates callers, scopes tenants, enforces idempotency, persists task state, and forwards trace context.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s84 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
