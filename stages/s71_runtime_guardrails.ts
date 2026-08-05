import { type AgentEvent, agentLoop as previousAgentLoop } from "./s70_release_orchestrator.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type RuntimeBudget = {
  maxIterations: number;
  maxToolCalls: number;
  maxOutputChars: number;
  maxCost: number;
};
export type RuntimeUsage = {
  iterations: number;
  toolCalls: number;
  outputChars: number;
  cost: number;
};

export class BudgetExceeded extends Error {
  constructor(public readonly resource: keyof RuntimeUsage) {
    super(`runtime budget exceeded: ${resource}`);
  }
}

export class RuntimeGuardrails {
  readonly usage: RuntimeUsage = { iterations: 0, toolCalls: 0, outputChars: 0, cost: 0 };
  constructor(readonly budget: RuntimeBudget) {}
  iteration(signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    this.usage.iterations++;
    if (this.usage.iterations > this.budget.maxIterations) throw new BudgetExceeded("iterations");
  }
  tool() {
    if (++this.usage.toolCalls > this.budget.maxToolCalls) throw new BudgetExceeded("toolCalls");
  }
  output(text: string) {
    this.usage.outputChars += text.length;
    if (this.usage.outputChars > this.budget.maxOutputChars) {
      throw new BudgetExceeded("outputChars");
    }
  }
  cost(amount: number) {
    this.usage.cost += Math.max(0, amount);
    if (this.usage.cost > this.budget.maxCost) throw new BudgetExceeded("cost");
  }
}

export async function runBounded<T>(
  steps: Array<(guardrails: RuntimeGuardrails) => Promise<T>>,
  budget: RuntimeBudget,
  signal?: AbortSignal,
) {
  const guardrails = new RuntimeGuardrails(budget), results: T[] = [];
  for (const step of steps) {
    guardrails.iteration(signal);
    results.push(await step(guardrails));
  }
  return { results, usage: guardrails.usage };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "runtime_guardrails",
    description: "Run bounded iterations with hard tool, output, cost, and cancellation limits",
    parameters: { type: "object", properties: { steps: { type: "number" } }, required: ["steps"] },
  },
};
registerTool(definition, async (input) => {
  const count = Math.min(5, Math.max(1, Number(input.steps)));
  const result = await runBounded(
    Array.from({ length: count }, (_, index) => async (guardrails) => {
      guardrails.tool();
      guardrails.output(`step-${index}`);
      guardrails.cost(0.01);
      return `step-${index}`;
    }),
    { maxIterations: 5, maxToolCalls: 5, maxOutputChars: 1_000, maxCost: 1 },
  );
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s71-runtime-guardrails",
  title: "Production runtime guardrails",
  priority: 52,
  content:
    "The main loop must stop on explicit iteration, tool, output, cost, or cancellation limits. Budgets are runtime state, not suggestions in a prompt.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s71 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
