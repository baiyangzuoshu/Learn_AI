import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "./s79_cognitive_production_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ServiceMetric = {
  successRate: number;
  p95LatencyMs: number;
  cost: number;
  errorRate: number;
  timestamp: string;
};
export type Alert = {
  id: string;
  severity: "warning" | "critical";
  signal: string;
  value: number;
  threshold: number;
};
export type ReleaseState = "healthy" | "degraded" | "rolled-back";
export class AIOpsController {
  state: ReleaseState = "healthy";
  readonly alerts: Alert[] = [];
  constructor(
    private readonly thresholds: {
      minSuccess: number;
      maxP95: number;
      maxCost: number;
      maxError: number;
    },
  ) {}
  observe(metric: ServiceMetric) {
    const checks: Array<[string, number, number, boolean]> = [
      [
        "successRate",
        metric.successRate,
        this.thresholds.minSuccess,
        metric.successRate < this.thresholds.minSuccess,
      ],
      [
        "p95LatencyMs",
        metric.p95LatencyMs,
        this.thresholds.maxP95,
        metric.p95LatencyMs > this.thresholds.maxP95,
      ],
      ["cost", metric.cost, this.thresholds.maxCost, metric.cost > this.thresholds.maxCost],
      [
        "errorRate",
        metric.errorRate,
        this.thresholds.maxError,
        metric.errorRate > this.thresholds.maxError,
      ],
    ];
    for (const [signal, value, threshold, failed] of checks) {
      if (failed) {
        this.alerts.push({
          id: `alert-${crypto.randomUUID().slice(0, 8)}`,
          severity: signal === "successRate" || signal === "errorRate" ? "critical" : "warning",
          signal,
          value,
          threshold,
        });
      }
    }
    if (this.alerts.some((alert) => alert.severity === "critical")) this.state = "degraded";
    return this.alerts;
  }
  rollback(reason: string) {
    this.state = "rolled-back";
    this.alerts.push({
      id: `incident-${crypto.randomUUID().slice(0, 8)}`,
      severity: "critical",
      signal: "rollback",
      value: 1,
      threshold: 0,
    });
    return { state: this.state, reason };
  }
  runbook() {
    return [
      "freeze promotion",
      "capture trace and release fingerprint",
      "route traffic to last healthy version",
      "open incident",
      "replay failed evaluation cases",
    ];
  }
}
export function releaseFingerprint(manifest: Record<string, unknown>) {
  return Array.from(new TextEncoder().encode(JSON.stringify(manifest))).reduce(
    (hash, byte) => (hash * 33 + byte) >>> 0,
    5381,
  ).toString(16);
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "aiops_release_runtime",
    description:
      "Observe SLO metrics, create severity alerts, rollback a degraded release, and emit an incident runbook",
    parameters: {
      type: "object",
      properties: { success_rate: { type: "number" } },
      required: ["success_rate"],
    },
  },
};
registerTool(definition, async (input) => {
  const controller = new AIOpsController({
    minSuccess: 0.98,
    maxP95: 800,
    maxCost: 1,
    maxError: 0.05,
  });
  const alerts = controller.observe({
    successRate: Number(input.success_rate),
    p95LatencyMs: 300,
    cost: 0.1,
    errorRate: 0.01,
    timestamp: new Date().toISOString(),
  });
  return JSON.stringify({
    alerts,
    state: controller.state,
    runbook: controller.runbook(),
    fingerprint: releaseFingerprint({ version: "1.0.0", model: "lesson" }),
  });
});
registerSystemPromptSection({
  id: "s80-aiops-release",
  title: "AIOps and release evidence",
  priority: 61,
  content:
    "Production operation closes the loop: collect SLO and cost signals, alert on thresholds, freeze promotion, rollback to a healthy fingerprint, and preserve an incident runbook.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s80 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
