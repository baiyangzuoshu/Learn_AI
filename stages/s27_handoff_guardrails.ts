import { type AgentEvent, agentLoop } from "./s26_mcp_capability_negotiation.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "handoff_validate",
    description: "Validate an Agent handoff envelope and its input/output guardrails",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        objective: { type: "string" },
        evidence: { type: "array" },
        allowed_tools: { type: "array" },
        max_tool_calls: { type: "number" },
      },
      required: ["from", "to", "objective", "evidence", "allowed_tools", "max_tool_calls"],
    },
  },
};
registerTool(definition, async (input) => {
  const from = String(input.from ?? "").trim(), to = String(input.to ?? "").trim();
  const objective = String(input.objective ?? "").trim();
  const evidence = Array.isArray(input.evidence) ? input.evidence.map(String) : [];
  const allowedTools = Array.isArray(input.allowed_tools) ? input.allowed_tools.map(String) : [];
  const maxToolCalls = Math.floor(Number(input.max_tool_calls));
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(from) || !/^[A-Za-z0-9._-]{1,64}$/.test(to)) {
    throw new Error("handoff member ids are invalid");
  }
  if (from === to) throw new Error("handoff target must differ from sender");
  if (!objective || objective.length > 4_000) throw new Error("handoff objective is invalid");
  if (!evidence.length || evidence.length > 50) {
    throw new Error("handoff requires 1–50 evidence items");
  }
  if (allowedTools.length > 50 || new Set(allowedTools).size !== allowedTools.length) {
    throw new Error("allowed_tools are invalid or duplicated");
  }
  if (maxToolCalls < 1 || maxToolCalls > 100) throw new Error("max_tool_calls must be 1–100");
  return JSON.stringify({
    valid: true,
    handoffId: `handoff-${crypto.randomUUID()}`,
    from,
    to,
    objective,
    evidenceCount: evidence.length,
    allowedTools,
    maxToolCalls,
  });
});
registerSystemPromptSection({
  id: "s27-handoff-guardrails",
  title: "Handoff guardrails",
  priority: 8,
  content:
    "Every handoff names sender, receiver, scoped objective, evidence, allowed tools, and budget. Reject ambiguous or self-referential handoffs, validate outputs before accepting them, and preserve responsibility across transitions.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s27 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
