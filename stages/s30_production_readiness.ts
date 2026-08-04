import { type AgentEvent, agentLoop as cognitiveAgentLoop } from "./s29_cognitive_monitor.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

const advancedCapabilities = [
  "Bounded Runtime",
  "Structured Tracing",
  "Evaluation and Feedback",
  "Retrieval Augmented Memory",
  "Planner Executor Verifier",
  "MCP Capability Negotiation",
  "Handoff Guardrails",
  "Checkpoint Resume",
  "Cognitive Monitor",
  "Production Readiness",
];
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "production_readiness_check",
    description:
      "Evaluate required production Agent controls without claiming deployment readiness",
    parameters: {
      type: "object",
      properties: { controls: { type: "object" } },
      required: ["controls"],
    },
  },
};
registerTool(definition, async (input) => {
  const controls = input.controls as Record<string, unknown>;
  if (!controls || typeof controls !== "object" || Array.isArray(controls)) {
    throw new Error("controls must be an object");
  }
  const required = [
    "boundedRuntime",
    "schemaValidation",
    "permissionEnforcement",
    "secretRedaction",
    "structuredTracing",
    "evaluationRegression",
    "checkpointRecovery",
    "releaseVerification",
  ];
  const passed = required.filter((name) => controls[name] === true);
  const missing = required.filter((name) => controls[name] !== true);
  return JSON.stringify({
    ready: missing.length === 0,
    passed,
    missing,
    note: "native runtime testing is still required",
  });
});
registerSystemPromptSection({
  id: "s30-production-readiness",
  title: "Production readiness",
  priority: 11,
  content:
    "Production readiness requires verified runtime bounds, schema validation, permissions, secret redaction, traces, regression evaluations, recovery, and release checks. Cross-compilation alone never proves native runtime behavior.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
): Promise<string> {
  onHook({
    name: "AdvancedHarnessReady",
    detail: `s21–s30 · ${advancedCapabilities.join(", ")}`,
  });
  return await cognitiveAgentLoop(
    query,
    onEvent,
    model,
    history,
    permissionMode,
    signal,
    onHook,
  );
}

if (import.meta.main) {
  const query = prompt("s30 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
