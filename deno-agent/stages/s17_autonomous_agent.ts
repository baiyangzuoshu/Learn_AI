import { type AgentEvent, agentLoop as protocolAgentLoop } from "./s16_team_protocol.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

let autonomousActive = false;
interface IterationResult {
  iteration: number;
  output: string;
  completed: boolean;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "autonomous_run",
    description: "Run a bounded autonomous observe-act-evaluate loop for a complex objective",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
        success_criteria: { type: "array", items: { type: "string" } },
        max_iterations: { type: "number", minimum: 1, maximum: 6 },
        max_minutes: { type: "number", minimum: 1, maximum: 30 },
      },
      required: ["objective", "success_criteria"],
    },
  },
};

registerTool(definition, async (input) => {
  if (autonomousActive) throw new Error("Nested autonomous runs are disabled");
  const objective = String(input.objective ?? "").trim();
  const criteria = Array.isArray(input.success_criteria)
    ? input.success_criteria.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
  const maxIterations = Math.min(6, Math.max(1, Math.floor(Number(input.max_iterations ?? 4))));
  const maxMinutes = Math.min(30, Math.max(1, Math.floor(Number(input.max_minutes ?? 10))));
  if (!objective || objective.length > 20_000) throw new Error("objective is invalid");
  if (!criteria.length || criteria.length > 12) {
    throw new Error("success_criteria requires 1 to 12 items");
  }
  const deadline = Date.now() + maxMinutes * 60_000, iterations: IterationResult[] = [];
  autonomousActive = true;
  try {
    for (let iteration = 1; iteration <= maxIterations && Date.now() < deadline; iteration++) {
      const previous = iterations.map((item) =>
        `Iteration ${item.iteration}: ${item.output.slice(0, 3_000)}`
      ).join("\n\n");
      const output = await protocolAgentLoop(
        `You are running bounded autonomous iteration ${iteration}/${maxIterations}.\n\nObjective:\n${objective}\n\nSuccess criteria:\n${
          criteria.map((item, index) => `${index + 1}. ${item}`).join("\n")
        }\n\nPrevious iteration evidence:\n${
          previous || "(none)"
        }\n\nObserve the current workspace state, take the safest useful actions, verify results, then finish with exactly one marker: [AUTONOMY_COMPLETE] only if every success criterion is verified, otherwise [AUTONOMY_CONTINUE]. Do not create another autonomous run.`,
        () => {},
        undefined,
        [],
        "ask",
      );
      const completed = output.includes("[AUTONOMY_COMPLETE]");
      iterations.push({ iteration, output, completed });
      if (completed) break;
    }
    return JSON.stringify({
      objective,
      successCriteria: criteria,
      status: iterations.at(-1)?.completed
        ? "completed"
        : Date.now() >= deadline
        ? "timed_out"
        : "iteration_limit",
      iterations,
      elapsedMs: maxMinutes * 60_000 - Math.max(0, deadline - Date.now()),
    });
  } finally {
    autonomousActive = false;
  }
});
registerSystemPromptSection({
  id: "s17-autonomy",
  title: "Bounded autonomy",
  priority: 50,
  content:
    "Use autonomous_run only for complex work that benefits from repeated observation, action, and verification. Always provide measurable success criteria and tight iteration/time limits. Stop early when verified, preserve completed work, and report blockers honestly. Never use autonomy to bypass permissions, create infinite loops, or broaden the user's scope.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
): Promise<string> {
  onHook({
    name: "AutonomyReady",
    detail: "max 6 iterations · max 30 minutes · explicit success criteria",
  });
  return await protocolAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name === "autonomous_run") {
        onHook({
          name: "AutonomyCompleted",
          detail: `${event.output.length} chars`,
        });
      }
    },
    model,
    history,
    permissionMode,
    signal,
    onHook,
  );
}
if (import.meta.main) {
  const query = prompt("s17 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
