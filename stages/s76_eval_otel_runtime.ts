import { type AgentEvent, agentLoop as previousAgentLoop } from "./s75_memory_service.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type OTelSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
};
export class OTelRecorder {
  readonly spans: OTelSpan[] = [];
  async run<T>(
    name: string,
    attributes: OTelSpan["attributes"],
    work: (context: { traceId: string; spanId: string }) => Promise<T>,
    parent?: { traceId: string; spanId: string },
  ) {
    const context = {
        traceId: parent?.traceId ?? crypto.randomUUID(),
        spanId: crypto.randomUUID().slice(0, 16),
      },
      started = performance.now(),
      startTime = new Date().toISOString();
    try {
      return await work(context);
    } finally {
      this.spans.push({
        ...context,
        parentSpanId: parent?.spanId,
        name,
        startTime,
        durationMs: Math.round(performance.now() - started),
        attributes,
      });
    }
  }
  export() {
    return { resource: { service: "lesson-agent" }, spans: this.spans };
  }
}
export type EvalCase = { id: string; input: string; expected: string; source?: string };
export async function evaluateDataset(
  cases: EvalCase[],
  runner: (input: string) => Promise<string>,
  recorder = new OTelRecorder(),
) {
  const results = [] as Array<{ id: string; actual: string; grounded: boolean; passed: boolean }>;
  for (const item of cases.slice(0, 50)) {
    const actual = await recorder.run(
      "agent.evaluation",
      { "eval.case_id": item.id },
      () => runner(item.input),
    );
    const grounded = !item.source || actual.includes(item.source);
    results.push({
      id: item.id,
      actual,
      grounded,
      passed: grounded && actual.trim() === item.expected.trim(),
    });
  }
  return {
    passRate: results.length ? results.filter((item) => item.passed).length / results.length : 0,
    groundingRate: results.length
      ? results.filter((item) => item.grounded).length / results.length
      : 0,
    results,
    telemetry: recorder.export(),
  };
}
export function regressionGate(
  current: { passRate: number; groundingRate: number },
  baseline: { passRate: number; groundingRate: number },
  tolerance = 0.03,
) {
  return {
    passed: current.passRate >= baseline.passRate - tolerance &&
      current.groundingRate >= baseline.groundingRate - tolerance,
    reasons: [
      current.passRate < baseline.passRate - tolerance ? "pass rate regression" : "",
      current.groundingRate < baseline.groundingRate - tolerance ? "grounding regression" : "",
    ].filter(Boolean),
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "eval_otel_runtime",
    description: "Run a dataset with trace spans, grounding checks, and a baseline regression gate",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      await evaluateDataset([{
        id: "demo",
        input: String(input.input),
        expected: String(input.input),
      }], async (value) => value),
    ),
);
registerSystemPromptSection({
  id: "s76-eval-otel",
  title: "OpenTelemetry evaluation runtime",
  priority: 57,
  content:
    "Evaluation stores trace context, latency, dataset results, grounding signals, and regression decisions together so quality changes can be explained and reproduced.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s76 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
