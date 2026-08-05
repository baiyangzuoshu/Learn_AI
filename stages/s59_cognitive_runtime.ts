import { type AgentEvent, agentLoop as previousAgentLoop } from "./s58_security_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Workspace = {
  query: string;
  observations: string[];
  plan: string[];
  actions: string[];
  memories: string[];
  confidence: number;
  iteration: number;
};
export interface Perception {
  sense(workspace: Workspace): Promise<string[]>;
}
export interface Planning {
  plan(workspace: Workspace): Promise<string[]>;
}
export interface Execution {
  act(workspace: Workspace, step: string): Promise<string>;
}
export interface Evaluation {
  assess(workspace: Workspace): Promise<{ done: boolean; confidence: number; reason: string }>;
}
export interface Attention {
  route(
    workspace: Workspace,
    assessment: { done: boolean; confidence: number; reason: string },
  ): "continue" | "escalate" | "complete";
}
export interface MemoryModule {
  recall(workspace: Workspace): Promise<string[]>;
  remember(workspace: Workspace): Promise<void>;
}

export class CognitiveRuntime {
  constructor(
    readonly perception: Perception,
    readonly planning: Planning,
    readonly execution: Execution,
    readonly evaluation: Evaluation,
    readonly attention: Attention,
    readonly memory: MemoryModule,
    readonly maxIterations = 5,
  ) {}
  async run(query: string): Promise<Workspace & { status: "complete" | "escalated" | "stopped" }> {
    const workspace: Workspace = {
      query,
      observations: [],
      plan: [],
      actions: [],
      memories: [],
      confidence: 0,
      iteration: 0,
    };
    workspace.memories = await this.memory.recall(workspace);
    for (; workspace.iteration < this.maxIterations; workspace.iteration++) {
      workspace.observations.push(...await this.perception.sense(workspace));
      if (!workspace.plan.length) workspace.plan = await this.planning.plan(workspace);
      const step = workspace.plan.shift();
      if (step) workspace.actions.push(await this.execution.act(workspace, step));
      const assessment = await this.evaluation.assess(workspace);
      workspace.confidence = assessment.confidence;
      const route = this.attention.route(workspace, assessment);
      if (route === "complete") {
        await this.memory.remember(workspace);
        return { ...workspace, status: "complete" };
      }
      if (route === "escalate") return { ...workspace, status: "escalated" };
    }
    return { ...workspace, status: "stopped" };
  }
}

function lessonRuntime() {
  return new CognitiveRuntime(
    { sense: async (workspace) => [`observation:${workspace.query}`] },
    { plan: async () => ["retrieve", "verify"] },
    { act: async (_workspace, step) => `action:${step}` },
    {
      assess: async (workspace) => ({
        done: workspace.actions.includes("action:verify"),
        confidence: workspace.actions.length ? 0.85 : 0.2,
        reason: "evidence and verification",
      }),
    },
    {
      route: (_workspace, assessment) =>
        assessment.confidence < 0.4 ? "escalate" : assessment.done ? "complete" : "continue",
    },
    {
      recall: async () => ["previous strategy"],
      remember: async (workspace) => {
        workspace.memories.push("strategy recorded");
      },
    },
  );
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_runtime_demo",
    description: "Run modular perception-planning-execution-evaluation-attention-memory runtime",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(
  definition,
  async (input) => JSON.stringify(await lessonRuntime().run(String(input.query))),
);
registerSystemPromptSection({
  id: "s59-cognitive-runtime",
  title: "Modular cognitive runtime",
  priority: 40,
  content:
    "The cognitive loop coordinates six explicit modules through one shared workspace. Perception observes, planning chooses, execution acts, evaluation assesses, attention routes, and memory recalls/records. Every module is bounded, cancellable, and observable.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(await lessonRuntime().run("permissions"));
  const query = prompt("s59 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
