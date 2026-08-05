import { type AgentEvent, agentLoop as previousAgentLoop } from "./s46_phoenix_human_feedback.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Pattern = "flow" | "orchestrator" | "debate" | "vote" | "peer";
export type AgentResult = { agent: string; answer: string; confidence: number };

export function runFlow(input: string, steps: Array<(value: string) => string>): string {
  return steps.reduce((value, step) => step(value), input);
}
export function orchestrate(
  tasks: string[],
  workers: Record<string, (task: string) => AgentResult>,
): AgentResult[] {
  return tasks.slice(0, 8).map((task, index) =>
    workers[Object.keys(workers)[index % Object.keys(workers).length]](task)
  );
}
export function vote(results: AgentResult[]): AgentResult | null {
  if (!results.length) return null;
  const groups = new Map<string, AgentResult[]>();
  for (const result of results) {
    groups.set(result.answer, [...(groups.get(result.answer) ?? []), result]);
  }
  return [...groups.values()].sort((left, right) =>
    right.length - left.length ||
    right.reduce((sum, item) => sum + item.confidence, 0) -
      left.reduce((sum, item) => sum + item.confidence, 0)
  )[0][0];
}
export function debate(results: AgentResult[]): { winner: AgentResult | null; dissent: string[] } {
  const winner = vote(results);
  return {
    winner,
    dissent: results.filter((result) => result.answer !== winner?.answer).map((result) =>
      result.answer
    ),
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "multi_agent_patterns_demo",
    description: "Compare flow, orchestration, debate, voting, and peer-style coordination",
    parameters: {
      type: "object",
      properties: { pattern: { type: "string" }, tasks: { type: "array" } },
      required: ["pattern", "tasks"],
    },
  },
};
registerTool(definition, async (input) => {
  const pattern = String(input.pattern) as Pattern;
  const tasks = Array.isArray(input.tasks) ? input.tasks.map(String) : [];
  const workers = {
    analyst: (task: string) => ({ agent: "analyst", answer: task.toUpperCase(), confidence: 0.7 }),
    reviewer: (task: string) => ({
      agent: "reviewer",
      answer: task.toUpperCase(),
      confidence: 0.9,
    }),
  };
  const results = orchestrate(tasks, workers);
  return JSON.stringify({
    pattern,
    flow: runFlow(tasks[0] ?? "", [(value) => value.trim(), (value) => value.toUpperCase()]),
    results,
    consensus: pattern === "debate" ? debate(results) : vote(results),
  });
});
registerSystemPromptSection({
  id: "s47-multi-agent-patterns",
  title: "Advanced multi-agent coordination",
  priority: 28,
  content:
    "Choose the simplest coordination pattern that fits: sequential flow, hub-and-spoke orchestration, debate, voting, or peer collaboration. Keep roles typed, tool scopes narrow, communication explicit, and consensus disagreement visible.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    debate([{ agent: "a", answer: "yes", confidence: 0.7 }, {
      agent: "b",
      answer: "no",
      confidence: 0.8,
    }]),
  );
  const query = prompt("s47 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
