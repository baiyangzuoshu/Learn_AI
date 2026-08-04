import { type AgentEvent, agentLoop } from "./s27_handoff_guardrails.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

interface Checkpoint {
  id: string;
  objective: string;
  iteration: number;
  completed: string[];
  pending: string[];
  evidence: string[];
  updatedAt: string;
}
const checkpointPath = (workspace: string, id: string) => {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) throw new Error("invalid checkpoint id");
  return `${workspace}/.deno-agent/checkpoints/${id}.json`;
};
async function writeAtomic(path: string, value: unknown) {
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await Deno.rename(temporary, path);
}

const writeDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "checkpoint_write",
    description: "Atomically persist bounded Agent loop state for later resume",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        objective: { type: "string" },
        iteration: { type: "number" },
        completed: { type: "array" },
        pending: { type: "array" },
        evidence: { type: "array" },
      },
      required: ["id", "objective", "iteration", "completed", "pending", "evidence"],
    },
  },
};
const readDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "checkpoint_read",
    description: "Read one persisted Agent loop checkpoint",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
};
registerTool(writeDefinition, async (input, workspace) => {
  const arrays = [input.completed, input.pending, input.evidence];
  if (arrays.some((value) => !Array.isArray(value) || value.length > 200)) {
    throw new Error("checkpoint arrays must contain at most 200 items");
  }
  const checkpoint: Checkpoint = {
    id: String(input.id ?? ""),
    objective: String(input.objective ?? "").trim(),
    iteration: Math.floor(Number(input.iteration)),
    completed: (input.completed as unknown[]).map(String),
    pending: (input.pending as unknown[]).map(String),
    evidence: (input.evidence as unknown[]).map(String),
    updatedAt: new Date().toISOString(),
  };
  if (!checkpoint.objective || checkpoint.objective.length > 10_000 || checkpoint.iteration < 0) {
    throw new Error("checkpoint state is invalid");
  }
  await writeAtomic(checkpointPath(workspace, checkpoint.id), checkpoint);
  return JSON.stringify({ id: checkpoint.id, iteration: checkpoint.iteration, saved: true });
});
registerTool(
  readDefinition,
  async (input, workspace) =>
    (await Deno.readTextFile(checkpointPath(workspace, String(input.id ?? "")))).slice(0, 50_000),
);
registerSystemPromptSection({
  id: "s28-checkpoint-resume",
  title: "Checkpoint and resume",
  priority: 9,
  content:
    "Checkpoint long loops after verified progress. Resume from persisted objective, completed work, pending work, and evidence; never repeat completed side effects merely because conversational context was lost.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s28 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
