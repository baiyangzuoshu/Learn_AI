import { type AgentEvent, agentLoop as previousAgentLoop } from "../s20_comprehensive/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type RunBudget = {
  iterations: number;
  toolCalls: number;
  outputChars: number;
  cost: number;
};
export class RuntimeBudget {
  readonly used = { iterations: 0, toolCalls: 0, outputChars: 0, cost: 0 };
  constructor(readonly limit: RunBudget) {}
  consume(kind: keyof RunBudget, amount = 1) {
    this.used[kind] += amount;
    if (this.used[kind] > this.limit[kind]) throw new Error(`${kind} budget exceeded`);
  }
}
export async function runBounded<T>(
  steps: Array<(budget: RuntimeBudget) => Promise<T>>,
  limit: RunBudget,
  signal?: AbortSignal,
) {
  const budget = new RuntimeBudget(limit), results: T[] = [];
  for (const step of steps) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    budget.consume("iterations");
    results.push(await step(budget));
  }
  return { results, used: budget.used };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "production_runtime",
    description:
      "Run one bounded agent lifecycle with tool, output, cost, and cancellation budgets",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) =>
  JSON.stringify(
    await runBounded([async (budget) => {
      budget.consume("toolCalls");
      const output = `handled:${input.query}`;
      budget.consume("outputChars", output.length);
      budget.consume("cost", .01);
      return output;
    }], { iterations: 4, toolCalls: 4, outputChars: 1000, cost: 1 }),
  ));
registerSystemPromptSection({
  id: "s21-runtime",
  title: "Production Agent Runtime",
  priority: 32,
  content:
    "Use one agent loop with explicit iteration, tool, output, cost, and cancellation budgets. A budget is executable state, not an instruction for the model to ignore.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s21 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
