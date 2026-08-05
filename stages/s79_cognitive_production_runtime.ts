import { type AgentEvent, agentLoop as previousAgentLoop } from "./s78_iam_sandbox_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type CognitiveWorkspace = {
  query: string;
  evidence: string[];
  plan: string[];
  actions: string[];
  confidence: number;
  iteration: number;
  stagnation: number;
  status: "running" | "complete" | "escalated" | "stopped";
};
export interface StrategySelector {
  choose(workspace: CognitiveWorkspace): Promise<{ step: string; confidence: number }>;
}
export interface WorkspaceMemory {
  recall(query: string): Promise<string[]>;
  record(workspace: CognitiveWorkspace): Promise<void>;
}
export interface ActionRunner {
  run(step: string, signal: AbortSignal): Promise<{ evidence: string; changed: boolean }>;
}

export class ProductionCognitiveLoop {
  constructor(
    private readonly selector: StrategySelector,
    private readonly memory: WorkspaceMemory,
    private readonly runner: ActionRunner,
    private readonly maxIterations = 6,
  ) {}
  async run(query: string, signal = new AbortController().signal) {
    const workspace: CognitiveWorkspace = {
      query,
      evidence: await this.memory.recall(query),
      plan: [],
      actions: [],
      confidence: 0,
      iteration: 0,
      stagnation: 0,
      status: "running",
    };
    for (; workspace.iteration < this.maxIterations; workspace.iteration++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const decision = await this.selector.choose(workspace);
      workspace.plan.push(decision.step);
      workspace.confidence = decision.confidence;
      if (workspace.confidence < 0.45) {
        workspace.status = "escalated";
        return workspace;
      }
      const result = await this.runner.run(decision.step, signal);
      workspace.actions.push(decision.step);
      workspace.evidence.push(result.evidence);
      workspace.stagnation = result.changed ? 0 : workspace.stagnation + 1;
      if (workspace.stagnation >= 2) {
        workspace.status = "escalated";
        return workspace;
      }
      if (decision.step === "finish" && result.changed) {
        workspace.status = "complete";
        await this.memory.record(workspace);
        return workspace;
      }
    }
    workspace.status = "stopped";
    return workspace;
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_production_runtime",
    description:
      "Run a bounded cognitive workspace with confidence gating, memory, cancellation, and stagnation escalation",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const result = await new ProductionCognitiveLoop(
    {
      choose: async (workspace) => ({
        step: workspace.actions.length ? "finish" : "inspect",
        confidence: 0.9,
      }),
    },
    { recall: async () => ["prior evidence"], record: async () => {} },
    { run: async (step) => ({ evidence: `evidence:${step}`, changed: true }) },
  ).run(String(input.query));
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s79-cognitive-production",
  title: "Production cognitive loop",
  priority: 60,
  content:
    "A shared workspace connects strategy selection, evidence, execution, memory, confidence gating, stagnation detection, and escalation. Cognitive behavior remains bounded and observable.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s79 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
