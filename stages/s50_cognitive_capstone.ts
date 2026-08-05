import { type AgentEvent, agentLoop as previousAgentLoop } from "./s49_identity_sandbox_egress.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type CognitiveState = {
  query: string;
  workspace: { evidence: string[]; plan: string[]; actions: string[]; memories: string[] };
  confidence: number;
  module: "perception" | "planning" | "execution" | "evaluation" | "attention" | "memory";
  status: "running" | "completed" | "escalated";
};
export type ReleaseManifest = {
  version: string;
  promptVersion: string;
  toolVersion: string;
  model: string;
  rollbackTo?: string;
};

export function perceive(query: string): string[] {
  return query.split(/\s+/).filter(Boolean).slice(0, 12);
}
export function plan(tokens: string[]): string[] {
  return tokens.length
    ? ["retrieve evidence", "draft answer", "verify claims"]
    : ["ask for clarification"];
}
export function evaluateState(state: CognitiveState): "continue" | "complete" | "escalate" {
  if (state.confidence < 0.4) return "escalate";
  if (state.workspace.evidence.length && state.workspace.actions.includes("verify claims")) {
    return "complete";
  }
  return "continue";
}
export function cognitiveCycle(query: string): CognitiveState {
  const tokens = perceive(query);
  const state: CognitiveState = {
    query,
    workspace: {
      evidence: [`evidence:${tokens[0] ?? "none"}`],
      plan: plan(tokens),
      actions: [],
      memories: [],
    },
    confidence: tokens.length ? 0.8 : 0.2,
    module: "perception",
    status: "running",
  };
  state.module = "planning";
  state.module = "execution";
  state.workspace.actions.push("retrieve evidence", "verify claims");
  state.module = "evaluation";
  const result = evaluateState(state);
  state.module = result === "escalate" ? "attention" : "memory";
  state.status = result === "complete"
    ? "completed"
    : result === "escalate"
    ? "escalated"
    : "running";
  if (state.status === "completed") state.workspace.memories.push("successful strategy recorded");
  return state;
}
export function releaseCheck(manifest: ReleaseManifest): string[] {
  const required = ["version", "promptVersion", "toolVersion", "model"] as const;
  return required.filter((field) => !manifest[field]);
}
export function metrics(state: CognitiveState) {
  return {
    confidence: state.confidence,
    evidence: state.workspace.evidence.length,
    actions: state.workspace.actions.length,
    status: state.status,
    module: state.module,
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_agent_capstone",
    description: "Run a bounded perception-planning-execution-evaluation-attention-memory cycle",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, manifest: { type: "object" } },
      required: ["query", "manifest"],
    },
  },
};
registerTool(definition, async (input) => {
  const state = cognitiveCycle(String(input.query));
  const manifest = input.manifest as ReleaseManifest;
  return JSON.stringify({ state, metrics: metrics(state), releaseMissing: releaseCheck(manifest) });
});
registerSystemPromptSection({
  id: "s50-cognitive-capstone",
  title: "Cognitive Agent capstone",
  priority: 31,
  content:
    "Coordinate perception, planning, execution, evaluation, attention, and memory through one bounded cognitive workspace. Gate low-confidence actions, record successful strategies, expose metrics, and require a versioned release manifest before production consideration.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(cognitiveCycle("research permissions"));
  const query = prompt("s50 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
