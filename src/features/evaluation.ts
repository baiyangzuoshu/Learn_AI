import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { readEvaluations, runEvaluation } from "../evaluation_service.ts";
import type { EvaluationCase, EvaluationRecord } from "../evaluation_service.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

function compact(record: EvaluationRecord): Record<string, unknown> {
  return {
    id: record.id,
    tenant: record.tenant,
    datasetVersion: record.datasetVersion,
    traceId: record.traceId,
    state: record.state,
    passRate: record.passRate,
    groundingRate: record.groundingRate,
    passThreshold: record.passThreshold,
    groundingThreshold: record.groundingThreshold,
    caseCount: record.caseCount,
    review: record.review.slice(0, 100),
    results: record.results.slice(0, 100),
    revision: record.revision,
    updatedAt: record.updatedAt,
  };
}

function output(record: EvaluationRecord): string {
  return JSON.stringify({
    evaluation: compact(record),
    releaseBlocked: record.state === "blocked",
  });
}

export const evaluation: HarnessFeature = {
  id: "evaluation-ci",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "evaluation_gate",
        "Score a versioned dataset and block release when quality or grounding regresses",
        {
          tenant: { type: "string" },
          dataset_version: { type: "string" },
          cases: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                input: { type: "string" },
                expected: { type: "string" },
                citation: { type: "string" },
              },
              required: ["id", "input", "expected"],
            },
          },
          outputs: { type: "object" },
          trace_id: { type: "string" },
          pass_threshold: { type: "number", minimum: 0.5, maximum: 1 },
          grounding_threshold: { type: "number", minimum: 0.5, maximum: 1 },
          idempotency_key: { type: "string" },
        },
        ["tenant", "dataset_version", "cases", "outputs"],
      ),
      async (input, context) =>
        output(
          await runEvaluation(context.workspace, {
            tenant: String(input.tenant ?? ""),
            datasetVersion: String(input.dataset_version ?? ""),
            cases: Array.isArray(input.cases) ? input.cases as EvaluationCase[] : [],
            outputs: input.outputs && typeof input.outputs === "object"
              ? input.outputs as Record<string, string>
              : {},
            traceId: typeof input.trace_id === "string" ? input.trace_id : undefined,
            passThreshold: typeof input.pass_threshold === "number"
              ? input.pass_threshold
              : undefined,
            groundingThreshold: typeof input.grounding_threshold === "number"
              ? input.grounding_threshold
              : undefined,
            idempotencyKey: typeof input.idempotency_key === "string"
              ? input.idempotency_key
              : undefined,
          }, context.signal),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition("evaluation_status", "Read tenant-scoped evaluation gates and review queues", {
        id: { type: "string" },
        tenant: { type: "string" },
      }, ["tenant"]),
      async (input, context) => {
        const records = await readEvaluations(context.workspace, {
          id: typeof input.id === "string" ? input.id : undefined,
          tenant: String(input.tenant ?? ""),
        });
        const evaluations = records.slice(0, 20).map(compact);
        return JSON.stringify({ evaluation: evaluations[0] ?? null, evaluations });
      },
    );
    prompts.register({
      id: "evaluation-ci",
      title: "Evaluation CI and release gates",
      priority: 41,
      content:
        "Treat evaluation as a release gate, not a claim of quality. Run a versioned dataset against a bounded candidate output set, score exact correctness and citation grounding, preserve every failed case in the review queue, and block promotion when thresholds are missed. Keep datasets tenant-scoped and trace-linked; do not silently drop flaky, negative, safety, latency, or cost cases. Human review may resolve a case outside this deterministic gate, but it must leave explicit evidence before release.",
    });
  },
};
