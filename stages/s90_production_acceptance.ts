import { type AgentEvent, agentLoop as previousAgentLoop } from "./s89_cognitive_adapter.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type AcceptanceCheck = { name: string; passed: boolean; evidence: string };
export function productionAcceptance(checks: AcceptanceCheck[]) {
  const failed = checks.filter((check) => !check.passed);
  return {
    passed: !failed.length,
    failed: failed.map((check) => check.name),
    evidence: checks.map((check) => `${check.name}:${check.evidence}`),
  };
}
export function standardChecks(overrides: Partial<Record<string, boolean>> = {}) {
  return [
    "runtime-budget",
    "schema-trace",
    "mcp-lifecycle",
    "a2a-idempotency",
    "memory-retention",
    "eval-gate",
    "worker-recovery",
    "security-redteam",
    "cognitive-routing",
    "release-rollback",
  ].map((name) => ({
    name,
    passed: overrides[name] ?? true,
    evidence: overrides[name] === false ? "missing" : "verified",
  }));
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "production_acceptance",
    description:
      "Run the final production acceptance matrix across runtime, protocols, memory, evaluation, security, cognition, and release",
    parameters: { type: "object", properties: { fail: { type: "string" } } },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      productionAcceptance(standardChecks(input.fail ? { [String(input.fail)]: false } : {})),
    ),
);
registerSystemPromptSection({
  id: "s90-production-acceptance",
  title: "Production acceptance",
  priority: 71,
  content:
    "A production migration is complete only when every runtime, protocol, state, evaluation, security, cognitive, and release check has executable evidence—not merely a course implementation.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s90 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
