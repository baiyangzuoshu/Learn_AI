import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { checkpointTask, createTask, resumeTask, verifyTask } from "../task_ledger.ts";
import type { TaskRecord } from "../task_ledger.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

function taskOutput(task: TaskRecord): string {
  const evidence = task.evidence.slice(-8).map((item) => ({
    ...item,
    summary: item.summary.slice(0, 500),
  }));
  return JSON.stringify({ task: { ...task, evidence, evidenceCount: task.evidence.length } });
}

export const taskState: HarnessFeature = {
  id: "task-state",
  register({ tools, prompts }) {
    tools.register(
      definition("task_create", "Create a durable task ledger entry", {
        goal: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["goal"]),
      async (input, context) =>
        taskOutput(
          await createTask(
            context.workspace,
            String(input.goal ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
          ),
        ),
    );
    tools.register(
      definition("task_checkpoint", "Record evidence and a replay checkpoint", {
        id: { type: "string" },
        evidence: { type: "string" },
        checkpoint: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["id", "evidence", "checkpoint"]),
      async (input, context) =>
        taskOutput(
          await checkpointTask(
            context.workspace,
            String(input.id ?? ""),
            String(input.evidence ?? ""),
            String(input.checkpoint ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
          ),
        ),
    );
    tools.register(
      definition("task_verify", "Verify a task only when evidence exists", {
        id: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["id"]),
      async (input, context) =>
        taskOutput(
          await verifyTask(
            context.workspace,
            String(input.id ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
          ),
        ),
    );
    tools.register(
      definition("task_resume", "Read durable task state before continuing work", {
        id: { type: "string" },
      }, ["id"]),
      async (input, context) =>
        taskOutput(await resumeTask(context.workspace, String(input.id ?? ""))),
    );
    prompts.register({
      id: "task-state",
      title: "Task state and replay",
      priority: 35,
      content:
        "Long tasks keep an explicit goal, state, evidence, checkpoint, and idempotency key. Resume from durable evidence; never repeat a side effect merely because the chat history is incomplete, and never mark a task verified without evidence.",
    });
  },
};
