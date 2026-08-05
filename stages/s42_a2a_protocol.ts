import { type AgentEvent, agentLoop as previousAgentLoop } from "./s41_mcp_server_transports.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type A2AStatus =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "failed"
  | "canceled";
export type AgentCard = { id: string; name: string; url: string; skills: string[]; auth: string[] };
export type A2ATask = {
  id: string;
  skill: string;
  status: A2AStatus;
  input: string;
  artifacts: string[];
  history: string[];
};

const transitions: Record<A2AStatus, A2AStatus[]> = {
  submitted: ["working", "canceled"],
  working: ["input-required", "completed", "failed", "canceled"],
  "input-required": ["working", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

export function validateAgentCard(card: AgentCard): string[] {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9._-]+$/.test(card.id)) errors.push("invalid agent id");
  try {
    new URL(card.url);
  } catch {
    errors.push("invalid agent url");
  }
  if (!card.skills.length) errors.push("at least one skill is required");
  return errors;
}

export function transitionTask(task: A2ATask, next: A2AStatus, note = ""): A2ATask {
  if (!transitions[task.status].includes(next)) {
    throw new Error(`${task.status} cannot transition to ${next}`);
  }
  return { ...task, status: next, history: [...task.history, `${next}:${note}`] };
}

export function addArtifact(task: A2ATask, artifact: string): A2ATask {
  if (task.status !== "working" && task.status !== "completed") {
    throw new Error("artifacts require an active task");
  }
  return { ...task, artifacts: [...task.artifacts, artifact.slice(0, 10_000)] };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "a2a_task_demo",
    description: "Validate an Agent Card and advance a bounded A2A task",
    parameters: {
      type: "object",
      properties: {
        skill: { type: "string" },
        input: { type: "string" },
        agent: { type: "object" },
      },
      required: ["skill", "input", "agent"],
    },
  },
};
registerTool(definition, async (input) => {
  const agent = input.agent as AgentCard;
  const errors = validateAgentCard(agent);
  if (errors.length) throw new Error(errors.join("; "));
  let task: A2ATask = {
    id: `task-${crypto.randomUUID().slice(0, 8)}`,
    skill: String(input.skill),
    status: "submitted",
    input: String(input.input),
    artifacts: [],
    history: [],
  };
  task = transitionTask(task, "working", "worker accepted");
  task = addArtifact(task, "partial-result");
  task = transitionTask(task, "completed", "acceptance passed");
  return JSON.stringify({ agent, task });
});
registerSystemPromptSection({
  id: "s42-a2a-protocol",
  title: "Agent-to-Agent protocol",
  priority: 23,
  content:
    "A2A separates agent discovery from task execution. Publish an Agent Card, authenticate the caller, track typed task states, stream progress when needed, and return versioned artifacts with a complete history.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    validateAgentCard({
      id: "researcher",
      name: "Research",
      url: "https://example.test",
      skills: ["search"],
      auth: ["bearer"],
    }),
  );
  const query = prompt("s42 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
