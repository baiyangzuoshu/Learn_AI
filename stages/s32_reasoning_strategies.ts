import { type AgentEvent, agentLoop as previousAgentLoop } from "./s31_structured_io.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ReasoningStep = { thought: string; action?: string; observation?: string };

export function react(question: string, observations: string[]): ReasoningStep[] {
  return observations.map((observation, index) => ({
    thought: `decompose ${question} (step ${index + 1})`,
    action: "inspect evidence",
    observation,
  }));
}

export function treeOfThoughts(options: string[], score: (option: string) => number) {
  return [...options].map((option) => ({ option, score: score(option) }))
    .sort((left, right) => right.score - left.score);
}

export function reflexion(answer: string, rubric: string[]): { answer: string; gaps: string[] } {
  const gaps = rubric.filter((criterion) =>
    !answer.toLowerCase().includes(criterion.toLowerCase())
  );
  return { answer, gaps };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "reasoning_compare",
    description: "Compare bounded ReAct, tree-of-thoughts, and reflexion outputs",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        rubric: { type: "array", items: { type: "string" } },
      },
      required: ["question", "options", "rubric"],
    },
  },
};
registerTool(definition, async (input) => {
  const question = String(input.question);
  const options = Array.isArray(input.options) ? input.options.map(String).slice(0, 8) : [];
  const rubric = Array.isArray(input.rubric) ? input.rubric.map(String).slice(0, 20) : [];
  return JSON.stringify({
    react: react(question, options.slice(0, 3)),
    tree: treeOfThoughts(options, (option) => option.length),
    reflexion: reflexion(options[0] ?? "", rubric),
  });
});
registerSystemPromptSection({
  id: "s32-reasoning-strategies",
  title: "Reasoning strategies",
  priority: 13,
  content:
    "Use ReAct for evidence-driven action, tree search for alternatives, and reflexion for critique. Bound branches and iterations; expose short conclusions rather than hidden chain-of-thought.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(treeOfThoughts(["A", "BBBB", "CC"], (item) => item.length));
  const query = prompt("s32 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
