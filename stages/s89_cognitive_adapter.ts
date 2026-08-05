import { type AgentEvent, agentLoop as previousAgentLoop } from "./s88_security_assurance.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type CognitiveMetrics = {
  iterations: number;
  confidence: number;
  evidenceCount: number;
  stagnation: number;
  status: string;
};
export interface CognitiveComponent {
  perceive(query: string): Promise<string[]>;
  plan(evidence: string[]): Promise<string>;
  act(step: string, signal: AbortSignal): Promise<string>;
  evaluate(evidence: string[]): Promise<{ confidence: number; done: boolean }>;
  remember(evidence: string[]): Promise<void>;
}
export class CognitiveProductionAdapter {
  constructor(private readonly component: CognitiveComponent, private readonly maxIterations = 5) {}
  async run(query: string, signal = new AbortController().signal) {
    let evidence = await this.component.perceive(query),
      confidence = 0,
      stagnation = 0,
      last = "",
      iterations = 0;
    for (; iterations < this.maxIterations; iterations++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const step = await this.component.plan(evidence),
        output = await this.component.act(step, signal);
      if (output === last) stagnation++;
      else stagnation = 0;
      last = output;
      evidence.push(output);
      const assessment = await this.component.evaluate(evidence);
      confidence = assessment.confidence;
      if (assessment.done) {
        await this.component.remember(evidence);
        return {
          evidence,
          confidence,
          iterations: iterations + 1,
          stagnation,
          status: "complete" as const,
        };
      }
      if (confidence < .4 || stagnation >= 2) {
        return {
          evidence,
          confidence,
          iterations: iterations + 1,
          stagnation,
          status: "escalated" as const,
        };
      }
    }
    return { evidence, confidence, iterations, stagnation, status: "stopped" as const };
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_adapter",
    description:
      "Adapt perception, planning, execution, evaluation, attention, and memory to a bounded production loop",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const adapter = new CognitiveProductionAdapter({
    perceive: async (query) => [`perceived:${query}`],
    plan: async (evidence) => evidence.length > 1 ? "finish" : "inspect",
    act: async (step) => step === "finish" ? "verified:done" : "evidence:inspect",
    evaluate: async (evidence) => ({
      confidence: .9,
      done: evidence.some((value) => value.includes("done")),
    }),
    remember: async () => {},
  });
  return JSON.stringify(await adapter.run(String(input.query)));
});
registerSystemPromptSection({
  id: "s89-cognitive-adapter",
  title: "Cognitive production adapter",
  priority: 70,
  content:
    "Cognitive modules are injected into the one production loop. Perception, planning, execution, evaluation, attention, and memory share metrics, permissions, trace context, cancellation, and rollback semantics.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s89 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
