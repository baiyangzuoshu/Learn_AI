import { type AgentEvent, agentLoop as previousAgentLoop } from "./s59_cognitive_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ReleaseManifest = {
  version: string;
  prompt: string;
  tools: string;
  model: string;
  schema: number;
};
export type Slo = { successRate: number; p95LatencyMs: number; maxCost: number };
export type RunMetric = { success: boolean; latencyMs: number; cost: number };
export function validateManifest(current: ReleaseManifest, previous?: ReleaseManifest): string[] {
  const errors: string[] = [];
  if (!/^\d+\.\d+\.\d+$/.test(current.version)) errors.push("version must be semver");
  if (previous && current.schema < previous.schema) errors.push("schema cannot move backwards");
  if (!current.prompt || !current.tools || !current.model) {
    errors.push("prompt/tools/model versions are required");
  }
  return errors;
}
export function evaluateSlo(metrics: RunMetric[], slo: Slo) {
  const successes = metrics.filter((metric) => metric.success).length;
  const sorted = [...metrics].sort((a, b) => a.latencyMs - b.latencyMs);
  const p95 = sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].latencyMs
    : 0;
  const cost = metrics.reduce((sum, metric) => sum + metric.cost, 0);
  return {
    passed: metrics.length > 0 && successes / metrics.length >= slo.successRate &&
      p95 <= slo.p95LatencyMs && cost <= slo.maxCost,
    successRate: metrics.length ? successes / metrics.length : 0,
    p95LatencyMs: p95,
    cost,
  };
}
export async function chaos<T>(
  operation: () => Promise<T>,
  failures = 1,
): Promise<{ value?: T; attempts: number; recovered: boolean }> {
  let attempts = 0;
  while (attempts < failures + 2) {
    attempts++;
    try {
      return { value: await operation(), attempts, recovered: attempts > 1 };
    } catch {
      if (attempts > failures) throw new Error("chaos operation failed");
    }
  }
  throw new Error("unreachable");
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "release_chaos_demo",
    description: "Validate a release manifest, evaluate SLOs, and recover a transient fault",
    parameters: {
      type: "object",
      properties: { version: { type: "string" }, failure_count: { type: "number" } },
      required: ["version", "failure_count"],
    },
  },
};
registerTool(definition, async (input) => {
  let calls = 0;
  const recovery = await chaos(async () => {
    calls++;
    if (calls <= Number(input.failure_count)) throw new Error("transient");
    return "ok";
  }, Number(input.failure_count));
  const manifest = {
    version: String(input.version),
    prompt: "p1",
    tools: "t1",
    model: "m1",
    schema: 1,
  };
  const slo = evaluateSlo([{ success: true, latencyMs: 100, cost: 0.01 }, {
    success: true,
    latencyMs: 200,
    cost: 0.02,
  }], { successRate: 0.99, p95LatencyMs: 500, maxCost: 1 });
  return JSON.stringify({ manifestErrors: validateManifest(manifest), recovery, slo });
});
registerSystemPromptSection({
  id: "s60-release-chaos",
  title: "Release engineering and chaos validation",
  priority: 41,
  content:
    "Release prompts, tools, models, and schemas as a compatible manifest. Gate canaries on success, p95 latency, cost, and safety metrics; inject transient failures to verify retries, rollback, and incident evidence before production migration.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    validateManifest({ version: "1.0.0", prompt: "p1", tools: "t1", model: "m1", schema: 1 }),
  );
  const query = prompt("s60 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
