import { type AgentEvent, agentLoop as previousAgentLoop } from "./s42_a2a_protocol.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Thought = {
  id: string;
  parentId?: string;
  text: string;
  status: "active" | "revised" | "pruned";
  score: number;
};

export class ThoughtScratchpad {
  readonly thoughts = new Map<string, Thought>();
  add(text: string, parentId?: string, score = 0): Thought {
    const thought = {
      id: `thought-${this.thoughts.size + 1}`,
      parentId,
      text: text.slice(0, 2_000),
      status: "active" as const,
      score,
    };
    this.thoughts.set(thought.id, thought);
    return thought;
  }
  revise(id: string, text: string, score: number): Thought {
    const previous = this.thoughts.get(id);
    if (!previous) throw new Error("thought not found");
    previous.status = "revised";
    return this.add(text, previous.parentId, score);
  }
  pruneBelow(threshold: number): number {
    let count = 0;
    for (const thought of this.thoughts.values()) {
      if (thought.score < threshold && thought.status === "active") {
        thought.status = "pruned";
        count++;
      }
    }
    return count;
  }
}

export function chooseStrategy(complexity: number): "direct" | "react" | "tree" | "reflexion" {
  if (complexity < 0.25) return "direct";
  if (complexity < 0.6) return "react";
  if (complexity < 0.85) return "tree";
  return "reflexion";
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "sequential_thinking_demo",
    description: "Store, revise, branch, and prune typed reasoning scratchpad items",
    parameters: {
      type: "object",
      properties: { complexity: { type: "number" }, threshold: { type: "number" } },
      required: ["complexity", "threshold"],
    },
  },
};
registerTool(definition, async (input) => {
  const pad = new ThoughtScratchpad();
  const root = pad.add("decompose task", undefined, 0.8);
  pad.add("candidate A", root.id, 0.4);
  pad.add("candidate B", root.id, 0.9);
  const pruned = pad.pruneBelow(Number(input.threshold));
  return JSON.stringify({
    strategy: chooseStrategy(Number(input.complexity)),
    pruned,
    thoughts: [...pad.thoughts.values()],
  });
});
registerSystemPromptSection({
  id: "s43-sequential-thinking",
  title: "Sequential Thinking scratchpad",
  priority: 24,
  content:
    "Use a typed scratchpad for multi-step reasoning: add, revise, branch, score, and prune thoughts. Keep the scratchpad bounded and separate from user-visible chain-of-thought; only expose decisions and evidence.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(chooseStrategy(0.7));
  const query = prompt("s43 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
