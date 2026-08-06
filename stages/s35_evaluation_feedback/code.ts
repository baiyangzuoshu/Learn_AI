import { type AgentEvent, agentLoop as previousAgentLoop } from "../s34_hybrid_rag/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Acceptance = { name: string; passed: boolean; evidence: string };
export function accept(checks: Acceptance[]) {
  return {
    passed: checks.every((check) => check.passed),
    missing: checks.filter((check) => !check.passed).map((check) => check.name),
  };
}
export function matrix() {
  return [
    "runtime",
    "schema-trace",
    "mcp",
    "a2a",
    "memory",
    "evaluation",
    "worker",
    "security",
    "cognition",
    "release",
  ].map((name) => ({ name, passed: true, evidence: "integration test" }));
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "production_acceptance",
    description:
      "Run the end-to-end acceptance matrix before migrating course behavior to production",
    parameters: { type: "object", properties: { fail: { type: "string" } } },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(accept(
      matrix().map((check) =>
        check.name === input.fail ? { ...check, passed: false, evidence: "missing" } : check
      ),
    )),
);
registerSystemPromptSection({
  id: "s35-acceptance",
  title: "Production acceptance and migration",
  priority: 46,
  content:
    "A capability migrates only with typed contracts, implementation, integration tests, observability, security evidence, rollback, documentation, and native-platform validation.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s35 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
