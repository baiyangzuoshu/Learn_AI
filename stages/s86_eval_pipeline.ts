import { type AgentEvent, agentLoop as previousAgentLoop } from "./s85_memory_persistence.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type EvalExample = { id: string; input: string; expected: string; evidence?: string };
export type EvalObservation = {
  exampleId: string;
  output: string;
  pass: boolean;
  grounded: boolean;
  latencyMs: number;
  traceId: string;
};
export type HumanReview = { exampleId: string; label: "approve" | "reject"; note: string };
export class EvaluationPipeline {
  readonly reviews: HumanReview[] = [];
  constructor(
    private readonly judge: (
      example: EvalExample,
      output: string,
    ) => Promise<{ pass: boolean; grounded: boolean }>,
  ) {}
  async run(examples: EvalExample[], runner: (input: string, traceId: string) => Promise<string>) {
    const observations: EvalObservation[] = [];
    for (const example of examples.slice(0, 100)) {
      const traceId = crypto.randomUUID(),
        started = performance.now(),
        output = await runner(example.input, traceId),
        result = await this.judge(example, output);
      observations.push({
        exampleId: example.id,
        output,
        ...result,
        latencyMs: Math.round(performance.now() - started),
        traceId,
      });
      if (!result.pass || !result.grounded) {
        this.reviews.push({ exampleId: example.id, label: "reject", note: "needs human review" });
      }
    }
    return {
      observations,
      passRate: observations.length
        ? observations.filter((item) => item.pass).length / observations.length
        : 0,
      groundingRate: observations.length
        ? observations.filter((item) => item.grounded).length / observations.length
        : 0,
      reviews: this.reviews,
    };
  }
}
export function evaluationGate(
  current: { passRate: number; groundingRate: number },
  baseline: { passRate: number; groundingRate: number },
) {
  const reasons = [];
  if (current.passRate < baseline.passRate - .02) reasons.push("pass rate regression");
  if (current.groundingRate < baseline.groundingRate - .02) reasons.push("grounding regression");
  return { passed: !reasons.length, reasons };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "eval_pipeline",
    description:
      "Evaluate a dataset, retain trace-linked observations, route failures to human review, and gate releases",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const pipeline = new EvaluationPipeline(async (example, output) => ({
    pass: output === example.expected,
    grounded: !example.evidence || output.includes(example.evidence),
  }));
  return JSON.stringify(
    await pipeline.run([{
      id: "case-1",
      input: String(input.input),
      expected: String(input.input),
    }], async (value) => value),
  );
});
registerSystemPromptSection({
  id: "s86-eval-pipeline",
  title: "Evaluation and human-review pipeline",
  priority: 67,
  content:
    "Evaluation is a stored pipeline: dataset cases produce trace-linked observations, grounding checks, human-review items, and a baseline regression decision.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s86 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
