import { type AgentEvent, agentLoop as previousAgentLoop } from "./s87_worker_orchestrator.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Threat = {
  id: string;
  surface: string;
  control: string;
  severity: "low" | "medium" | "high";
};
export type SecurityCheck = { id: string; attack: string; passed: boolean; evidence: string };
export const threatModel: Threat[] = [
  { id: "T1", surface: "tool input", control: "schema and permission gate", severity: "high" },
  { id: "T2", surface: "remote URL", control: "HTTPS allowlist and SSRF block", severity: "high" },
  { id: "T3", surface: "model output", control: "DLP and redaction", severity: "medium" },
  {
    id: "T4",
    surface: "child process",
    control: "sandbox, timeout, and cancellation",
    severity: "high",
  },
];
export function runRedTeamChecks(
  checks: Array<{ id: string; attack: string; control: () => boolean }>,
): SecurityCheck[] {
  return checks.map((check) => ({
    id: check.id,
    attack: check.attack,
    passed: check.control(),
    evidence: check.control() ? "control blocked attack" : "control failed",
  }));
}
export function securityGate(results: SecurityCheck[]) {
  return {
    passed: results.every((result) => result.passed),
    failures: results.filter((result) => !result.passed).map((result) => result.id),
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "security_assurance",
    description: "Run threat-model controls and red-team checks before release",
    parameters: {
      type: "object",
      properties: { payload: { type: "string" } },
      required: ["payload"],
    },
  },
};
registerTool(definition, async (input) => {
  const results = runRedTeamChecks([{
    id: "prompt-injection",
    attack: "ignore system policy",
    control: () => !String(input.payload).toLowerCase().includes("ignore system"),
  }, {
    id: "secret-exfiltration",
    attack: "send api_key",
    control: () => !/api[_-]?key/i.test(String(input.payload)),
  }]);
  return JSON.stringify({ threatModel, results, gate: securityGate(results) });
});
registerSystemPromptSection({
  id: "s88-security-assurance",
  title: "Threat model and red-team assurance",
  priority: 69,
  content:
    "Security is proven with explicit threats, controls, negative tests, evidence, and a release gate. Passing examples are not evidence that injection, SSRF, DLP, and sandbox escapes are blocked.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s88 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
