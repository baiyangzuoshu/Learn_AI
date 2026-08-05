import { type AgentEvent, agentLoop as previousAgentLoop } from "./s34_hybrid_rag.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Rubric = { id: string; description: string; weight: number; required?: boolean };
export type Evaluation = { score: number; passed: boolean; failures: string[]; feedback: string[] };

export function evaluate(answer: string, rubrics: Rubric[]): Evaluation {
  const failures: string[] = [];
  let total = 0;
  let weight = 0;
  for (const rubric of rubrics) {
    const hit = answer.toLowerCase().includes(rubric.description.toLowerCase());
    weight += rubric.weight;
    if (hit) total += rubric.weight;
    else failures.push(rubric.id);
  }
  const score = weight ? total / weight : 0;
  return {
    score,
    passed: score >= 0.8 && !rubrics.some((item) => item.required && failures.includes(item.id)),
    failures,
    feedback: failures.map((id) => `add evidence for rubric ${id}`),
  };
}

export function phoenixLikeTrace(events: Array<{ name: string; output?: string }>) {
  return events.map((event, index) => ({
    sequence: index + 1,
    name: event.name,
    outputChars: event.output?.length ?? 0,
    hasError: event.output?.startsWith("Error:") ?? false,
  }));
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "evaluation_feedback_run",
    description: "Score an answer with a rubric and return actionable feedback",
    parameters: {
      type: "object",
      properties: { answer: { type: "string" }, rubrics: { type: "array" } },
      required: ["answer", "rubrics"],
    },
  },
};
registerTool(definition, async (input) => {
  const rubrics = Array.isArray(input.rubrics) ? input.rubrics as Rubric[] : [];
  return JSON.stringify(evaluate(String(input.answer), rubrics));
});
registerSystemPromptSection({
  id: "s35-evaluation-feedback",
  title: "Evaluation and feedback",
  priority: 16,
  content:
    "Use TDAD-style tests, critics, grounding checks, rubrics, and traces as a feedback loop. A score is a diagnostic signal; retain failures as regression cases.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(evaluate("include evidence and cite source", [
    { id: "evidence", description: "evidence", weight: 0.5, required: true },
    { id: "source", description: "source", weight: 0.5 },
  ]));
  const query = prompt("s35 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
