import { type AgentEvent, agentLoop as previousAgentLoop } from "./s44_memory_architecture.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ResearchFinding = { source: string; claim: string; confidence: number };
export type ResearchState = {
  goal: string;
  iteration: number;
  questions: string[];
  findings: ResearchFinding[];
  quality: number;
  status: "running" | "completed" | "stopped";
};

export function terminationGate(
  state: ResearchState,
  limits: { iterations: number; minQuality: number; maxFindings: number },
) {
  if (state.quality >= limits.minQuality) return "quality-threshold";
  if (state.iteration >= limits.iterations) return "iteration-limit";
  if (state.findings.length >= limits.maxFindings) return "finding-limit";
  if (!state.questions.length) return "no-follow-up-questions";
  return null;
}
export function researchIteration(
  state: ResearchState,
  findings: ResearchFinding[],
  nextQuestions: string[],
): ResearchState {
  const merged = [...state.findings, ...findings];
  const quality = Math.min(
    1,
    merged.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, merged.length),
  );
  return {
    ...state,
    iteration: state.iteration + 1,
    findings: merged,
    questions: nextQuestions,
    quality,
    status: "running",
  };
}
export function synthesize(state: ResearchState): string {
  return state.findings.map((finding) => `${finding.claim} [${finding.source}]`).join("\n");
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "deep_research_loop_demo",
    description: "Run a deterministic deep-research state loop with quality and follow-up gates",
    parameters: {
      type: "object",
      properties: { goal: { type: "string" }, max_iterations: { type: "number" } },
      required: ["goal"],
    },
  },
};
registerTool(definition, async (input) => {
  let state: ResearchState = {
    goal: String(input.goal),
    iteration: 0,
    questions: ["find primary evidence"],
    findings: [],
    quality: 0,
    status: "running",
  };
  const limit = Math.min(6, Math.max(1, Number(input.max_iterations) || 3));
  while (!terminationGate(state, { iterations: limit, minQuality: 0.8, maxFindings: 12 })) {
    state = researchIteration(state, [{
      source: `source-${state.iteration + 1}`,
      claim: `evidence for ${state.goal}`,
      confidence: 0.85,
    }], state.iteration < 1 ? ["cross-check evidence"] : []);
  }
  state.status = state.quality >= 0.8 ? "completed" : "stopped";
  return JSON.stringify({
    state,
    synthesis: synthesize(state),
    stopReason: terminationGate(state, { iterations: limit, minQuality: 0.8, maxFindings: 12 }),
  });
});
registerSystemPromptSection({
  id: "s45-deep-research-loop",
  title: "Deep research task loop",
  priority: 26,
  content:
    "Externalize long-horizon research state: goal, questions, findings, quality, and iteration. Separate exploration from synthesis, require source-backed claims, and stop on layered quality, budget, stagnation, and goal gates.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  let state: ResearchState = {
    goal: "demo",
    iteration: 0,
    questions: ["search"],
    findings: [],
    quality: 0,
    status: "running",
  };
  state = researchIteration(
    state,
    [{ source: "demo", claim: "typed evidence", confidence: 0.9 }],
    [],
  );
  console.log(synthesize(state));
  const query = prompt("s45 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
