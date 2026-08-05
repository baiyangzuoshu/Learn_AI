import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "./s26_mcp_capability_negotiation.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type AgentTask = {
  id: string;
  tenant: string;
  role: string;
  objective: string;
  traceId: string;
  state: "submitted" | "running" | "complete" | "failed";
  artifacts: string[];
};
export class AgentGateway {
  private readonly tasks = new Map<string, AgentTask>();
  submit(input: Omit<AgentTask, "id" | "state" | "artifacts">, key: string) {
    const existing = [...this.tasks.values()].find((task) => task.tenant + task.objective === key);
    if (existing) return existing;
    const task = {
      ...input,
      id: `a2a-${crypto.randomUUID().slice(0, 8)}`,
      state: "submitted" as const,
      artifacts: [],
    };
    this.tasks.set(task.id, task);
    return task;
  }
  handoff(id: string, artifact: string) {
    const task = this.tasks.get(id);
    if (!task || task.state === "complete") throw new Error("invalid handoff");
    task.artifacts.push(artifact.slice(0, 10_000));
    task.state = "running";
    return task;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "agent_handoff",
    description:
      "Create a tenant-scoped, idempotent, trace-linked multi-agent handoff with bounded artifacts",
    parameters: {
      type: "object",
      properties: { objective: { type: "string" } },
      required: ["objective"],
    },
  },
};
registerTool(definition, async (input) => {
  const gateway = new AgentGateway(),
    task = gateway.submit({
      tenant: "lesson",
      role: "researcher",
      objective: String(input.objective),
      traceId: crypto.randomUUID(),
    }, "lesson:" + input.objective);
  return JSON.stringify(gateway.handoff(task.id, "evidence"));
});
registerSystemPromptSection({
  id: "s27-a2a-teams",
  title: "A2A, handoff, and teams",
  priority: 38,
  content:
    "Delegation transfers objective, role, scope, evidence, trace, and bounded authority. Gateways enforce tenant isolation, idempotency, task state, artifact limits, and cancellation.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
