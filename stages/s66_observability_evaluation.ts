import { type AgentEvent, agentLoop as previousAgentLoop } from "./s65_research_worker_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Span = {
  traceId: string;
  name: string;
  attributes: Record<string, string | number | boolean>;
  durationMs: number;
};
export type Feedback = { caseId: string; label: "pass" | "fail" | "needs-review"; note: string };
export type EvaluationCase = { id: string; input: string; expected: string };

export class TraceRecorder {
  readonly spans: Span[] = [];
  async span<T>(name: string, attributes: Span["attributes"], work: () => Promise<T>) {
    const started = performance.now();
    try {
      return await work();
    } finally {
      this.spans.push({
        traceId: crypto.randomUUID(),
        name,
        attributes,
        durationMs: Math.round(performance.now() - started),
      });
    }
  }
}

export async function evaluateWithFeedback(
  cases: EvaluationCase[],
  runner: (input: string) => Promise<string>,
  judge: (expected: string, actual: string) => Promise<Feedback["label"]>,
  recorder = new TraceRecorder(),
) {
  const feedback: Feedback[] = [];
  for (const item of cases.slice(0, 50)) {
    const actual = await recorder.span("agent.eval", { caseId: item.id }, () => runner(item.input));
    const label = await judge(item.expected, actual);
    feedback.push({
      caseId: item.id,
      label,
      note: label === "pass" ? "" : `expected ${item.expected}`,
    });
  }
  const passed = feedback.filter((item) => item.label === "pass").length;
  return {
    passRate: feedback.length ? passed / feedback.length : 0,
    feedback,
    spans: recorder.spans,
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "observability_evaluation",
    description:
      "Record trace spans, run a dataset, apply a judge, and emit human-reviewable feedback",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const result = await evaluateWithFeedback(
    [{ id: "case-1", input: String(input.input), expected: String(input.input) }],
    async (value) => value,
    async (expected, actual) => expected === actual ? "pass" : "needs-review",
  );
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s66-observability-evaluation",
  title: "Trace, evaluation, and human feedback",
  priority: 47,
  content:
    "Every evaluation run emits trace spans, dataset results, judge labels, and human-reviewable feedback. Regression decisions must be reproducible from stored evidence.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s66 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
