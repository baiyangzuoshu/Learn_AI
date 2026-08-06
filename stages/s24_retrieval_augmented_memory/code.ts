import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s23_evaluation_feedback/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Work = {
  id: string;
  goal: string;
  state: "planned" | "running" | "verified" | "blocked";
  evidence: string[];
};
export class TaskLedger {
  readonly tasks = new Map<string, Work>();
  create(goal: string) {
    const task = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      goal,
      state: "planned" as const,
      evidence: [],
    };
    this.tasks.set(task.id, task);
    return task;
  }
  checkpoint(id: string, evidence: string) {
    const task = this.tasks.get(id);
    if (!task) throw new Error("task missing");
    task.evidence.push(evidence);
    task.state = "running";
    return task;
  }
  verify(id: string) {
    const task = this.tasks.get(id);
    if (!task || !task.evidence.length) throw new Error("evidence required");
    task.state = "verified";
    return task;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "task_checkpoint",
    description: "Plan, checkpoint, resume, and verify a long-running task with durable evidence",
    parameters: { type: "object", properties: { goal: { type: "string" } }, required: ["goal"] },
  },
};
registerTool(definition, async (input) => {
  const ledger = new TaskLedger(), task = ledger.create(String(input.goal));
  ledger.checkpoint(task.id, "first verified action");
  return JSON.stringify(ledger.verify(task.id));
});
registerSystemPromptSection({
  id: "s24-task-state",
  title: "Plans, checkpoints, and replay",
  priority: 35,
  content:
    "Long tasks keep explicit goal, state, evidence, checkpoint, and idempotency records. Resume from evidence; do not repeat side effects after interruption.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s24 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
