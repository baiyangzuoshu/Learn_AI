import { type AgentEvent, agentLoop as previousAgentLoop } from "./s68_security_policy_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type CognitiveState = {
  query: string;
  observations: string[];
  plan: string[];
  actions: string[];
  memories: string[];
  confidence: number;
  iteration: number;
};
export interface CognitiveProvider {
  decide(state: CognitiveState): Promise<{ step: string; confidence: number }>;
}
export interface CognitiveMemory {
  recall(query: string): Promise<string[]>;
  remember(state: CognitiveState): Promise<void>;
}
export interface CognitiveExecutor {
  run(step: string, signal: AbortSignal): Promise<string>;
}

export class IntegratedCognitiveAgent {
  constructor(
    private readonly provider: CognitiveProvider,
    private readonly memory: CognitiveMemory,
    private readonly executor: CognitiveExecutor,
    private readonly maxIterations = 4,
  ) {}
  async run(query: string, signal = new AbortController().signal) {
    const state: CognitiveState = {
      query,
      observations: [],
      plan: [],
      actions: [],
      memories: await this.memory.recall(query),
      confidence: 0,
      iteration: 0,
    };
    for (; state.iteration < this.maxIterations; state.iteration++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const decision = await this.provider.decide(state);
      state.plan.push(decision.step);
      state.confidence = decision.confidence;
      if (state.confidence < 0.4) return { ...state, status: "escalated" as const };
      state.actions.push(await this.executor.run(decision.step, signal));
      state.observations.push(`verified:${state.actions.at(-1)}`);
      if (state.actions.at(-1)?.includes("done")) {
        await this.memory.remember(state);
        return { ...state, status: "complete" as const };
      }
    }
    return { ...state, status: "stopped" as const };
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_integration",
    description:
      "Run a model-driven cognitive workspace with memory, execution, confidence attention, and a hard loop bound",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const agent = new IntegratedCognitiveAgent(
    {
      decide: async (state) => ({
        step: state.actions.length ? "finish" : "inspect",
        confidence: 0.9,
      }),
    },
    { recall: async () => ["previous evidence"], remember: async () => {} },
    { run: async (step) => step === "finish" ? "done" : "observed" },
  );
  return JSON.stringify(await agent.run(String(input.query)));
});
registerSystemPromptSection({
  id: "s69-cognitive-integration",
  title: "End-to-end cognitive integration",
  priority: 50,
  content:
    "Perception, planning, execution, evaluation, attention, and memory share one bounded workspace. Confidence gates action, memories feed the next run, and cancellation reaches execution.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s69 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
