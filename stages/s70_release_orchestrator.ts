import { type AgentEvent, agentLoop as previousAgentLoop } from "./s69_cognitive_integration.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Release = {
  version: string;
  prompt: string;
  model: string;
  tools: string;
  schema: number;
  digest: string;
};
export type ReleaseDecision = {
  passed: boolean;
  traffic: number;
  rollback: boolean;
  reasons: string[];
};
export function fingerprint(release: Omit<Release, "digest">) {
  return Array.from(new TextEncoder().encode(JSON.stringify(release))).reduce(
    (hash, byte) => (hash * 31 + byte) >>> 0,
    7,
  ).toString(16);
}
export function compatibility(previous: Release, next: Release) {
  const reasons: string[] = [];
  if (next.schema < previous.schema) reasons.push("schema downgrade");
  if (!next.prompt || !next.model || !next.tools) reasons.push("incomplete manifest");
  return reasons;
}
export class CanaryController {
  private active: Release;
  constructor(initial: Release) {
    this.active = initial;
  }
  evaluate(
    previous: Release,
    candidate: Release,
    successRate: number,
    maxCost: number,
    cost: number,
  ): ReleaseDecision {
    const reasons = compatibility(previous, candidate);
    if (successRate < 0.98) reasons.push("success SLO");
    if (cost > maxCost) reasons.push("cost SLO");
    const rollback = reasons.length > 0;
    if (!rollback) this.active = candidate;
    return { passed: !rollback, traffic: rollback ? 0 : 10, rollback, reasons };
  }
  current() {
    return this.active;
  }
}
export async function runChaos(operation: () => Promise<void>, failures = 1) {
  for (let attempt = 0; attempt <= failures; attempt++) {
    try {
      await operation();
      return attempt + 1;
    } catch {
      if (attempt === failures) throw new Error("chaos budget exhausted");
    }
  }
  return failures + 1;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "release_orchestrator",
    description:
      "Fingerprint a release, run compatibility and SLO gates, canary traffic, rollback, and chaos recovery",
    parameters: {
      type: "object",
      properties: { version: { type: "string" } },
      required: ["version"],
    },
  },
};
registerTool(definition, async (input) => {
  const previous = {
    version: "1.0.0",
    prompt: "p1",
    model: "m1",
    tools: "t1",
    schema: 1,
    digest: "old",
  };
  const candidateBase = {
    version: String(input.version),
    prompt: "p2",
    model: "m2",
    tools: "t2",
    schema: 2,
  };
  const candidate = { ...candidateBase, digest: fingerprint(candidateBase) };
  const controller = new CanaryController(previous);
  const decision = controller.evaluate(previous, candidate, 1, 1, 0.1);
  return JSON.stringify({ candidate, decision, active: controller.current() });
});
registerSystemPromptSection({
  id: "s70-release-orchestrator",
  title: "Canary, rollback, and production rehearsal",
  priority: 51,
  content:
    "A release is a signed, fingerprinted prompt/model/tool/schema bundle. Compatibility, SLO, chaos, canary traffic, and rollback are one auditable gate before production activation.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s70 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
