import { type AgentEvent, agentLoop as previousAgentLoop } from "./s54_research_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type EvalCase = { id: string; input: string; expected: string; tags: string[] };
export type EvalResult = {
  caseId: string;
  run: number;
  passed: boolean;
  score: number;
  latencyMs: number;
  feedback: string;
};
export type EvalRunner = (input: string) => Promise<string>;

export async function runEvaluation(
  cases: EvalCase[],
  runner: EvalRunner,
  repeats = 3,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const testCase of cases.slice(0, 100)) {
    for (let run = 1; run <= Math.min(5, repeats); run++) {
      const started = performance.now();
      try {
        const output = await runner(testCase.input);
        const passed = output.trim() === testCase.expected.trim();
        results.push({
          caseId: testCase.id,
          run,
          passed,
          score: passed ? 1 : 0,
          latencyMs: Math.round(performance.now() - started),
          feedback: passed ? "" : `expected ${testCase.expected}`,
        });
      } catch (error) {
        results.push({
          caseId: testCase.id,
          run,
          passed: false,
          score: 0,
          latencyMs: Math.round(performance.now() - started),
          feedback: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return results;
}

export function summarizeEvaluation(results: EvalResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const byCase = new Map<string, EvalResult[]>();
  for (const result of results) {
    byCase.set(result.caseId, [...(byCase.get(result.caseId) ?? []), result]);
  }
  return {
    total: results.length,
    passed,
    passRate: results.length ? passed / results.length : 0,
    flakyCases: [...byCase].filter(([, values]) =>
      new Set(values.map((value) => value.passed)).size > 1
    ).map(([id]) => id),
    p95LatencyMs: results.length
      ? [...results].sort((a, b) =>
        a.latencyMs - b.latencyMs
      )[Math.min(results.length - 1, Math.floor(results.length * 0.95))].latencyMs
      : 0,
  };
}

export function regressionGate(
  current: ReturnType<typeof summarizeEvaluation>,
  baseline: ReturnType<typeof summarizeEvaluation>,
  maxDrop = 0.05,
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (current.passRate < baseline.passRate - maxDrop) reasons.push("pass rate regression");
  if (current.p95LatencyMs > baseline.p95LatencyMs * 1.25) reasons.push("latency regression");
  if (current.flakyCases.length > baseline.flakyCases.length) reasons.push("flakiness regression");
  return { passed: reasons.length === 0, reasons };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "evaluation_harness_demo",
    description: "Run repeated typed evaluation cases and enforce a regression gate",
    parameters: {
      type: "object",
      properties: { repeats: { type: "number" } },
      required: ["repeats"],
    },
  },
};
registerTool(definition, async (input) => {
  const cases = [{ id: "echo", input: "hello", expected: "hello", tags: ["smoke"] }, {
    id: "negative",
    input: "wrong",
    expected: "right",
    tags: ["negative"],
  }];
  const results = await runEvaluation(cases, async (value) => value, Number(input.repeats) || 3);
  const summary = summarizeEvaluation(results);
  return JSON.stringify({
    results,
    summary,
    gate: regressionGate(summary, {
      ...summary,
      passRate: 0.5,
      p95LatencyMs: summary.p95LatencyMs,
      flakyCases: [],
    }),
  });
});
registerSystemPromptSection({
  id: "s55-evaluation-harness",
  title: "Evaluation harness",
  priority: 36,
  content:
    "Treat agent behavior as a repeated experiment: typed cases, positive and negative examples, latency and flakiness metrics, baseline comparison, and a regression gate. Never declare improvement from one stochastic run.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    summarizeEvaluation(
      await runEvaluation(
        [{ id: "smoke", input: "x", expected: "x", tags: [] }],
        async (value) => value,
      ),
    ),
  );
  const query = prompt("s55 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
