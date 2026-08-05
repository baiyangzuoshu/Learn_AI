import { type AgentEvent, agentLoop as previousAgentLoop } from "./s32_reasoning_strategies.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Handoff = {
  task: string;
  objective: string;
  evidence: string[];
  allowedTools: string[];
  acceptance: string[];
};

export function route(task: string): "research" | "build" | "review" {
  const text = task.toLowerCase();
  if (/review|audit|check|验证/.test(text)) return "review";
  if (/build|write|implement|实现/.test(text)) return "build";
  return "research";
}

export function validateHandoff(handoff: Handoff): string[] {
  const errors: string[] = [];
  if (!handoff.task.trim() || !handoff.objective.trim()) {
    errors.push("task and objective are required");
  }
  if (!handoff.acceptance.length) errors.push("at least one acceptance criterion is required");
  if (handoff.allowedTools.some((tool) => tool.startsWith("dangerous:"))) {
    errors.push("dangerous tools require an explicit approval boundary");
  }
  return errors;
}

export function guardrail(stage: string, handoff: Handoff, output: string) {
  const errors = validateHandoff(handoff);
  if (output.length > 10_000) errors.push("output exceeds stage limit");
  return { stage, allowed: errors.length === 0, errors };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "flow_handoff_check",
    description: "Route a task and validate a typed agent handoff",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string" },
        handoff: { type: "object" },
        output: { type: "string" },
      },
      required: ["task", "handoff", "output"],
    },
  },
};
registerTool(definition, async (input) => {
  const handoff = input.handoff as Handoff;
  return JSON.stringify(guardrail(route(String(input.task)), handoff, String(input.output)));
});
registerSystemPromptSection({
  id: "s33-flow-handoff-guardrails",
  title: "Flow, handoff, and guardrails",
  priority: 14,
  content:
    "A flow chooses the next specialist; a handoff carries objective, evidence, tools, and acceptance criteria. Guardrails validate the contract before and after every boundary.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(route("review the generated patch"));
  const query = prompt("s33 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
