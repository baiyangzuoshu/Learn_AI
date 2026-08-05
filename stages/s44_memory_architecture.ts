import { type AgentEvent, agentLoop as previousAgentLoop } from "./s43_sequential_thinking.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type MemoryKind = "semantic" | "episodic" | "procedural";
export type Memory = {
  id: string;
  kind: MemoryKind;
  text: string;
  embedding: number[];
  entities: string[];
  createdAt: number;
  importance: number;
};

export function embed(text: string): number[] {
  const vector = Array.from({ length: 8 }, () => 0);
  for (const [index, char] of [...text.toLowerCase()].entries()) {
    vector[index % vector.length] += char.charCodeAt(0) / 255;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
export function similarity(left: number[], right: number[]): number {
  return left.length === right.length
    ? left.reduce((sum, value, index) => sum + value * right[index], 0)
    : 0;
}
export function hybridMemorySearch(
  query: string,
  memories: Memory[],
  kinds?: MemoryKind[],
  limit = 5,
) {
  const wanted = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  return memories.filter((memory) => !kinds || kinds.includes(memory.kind)).map((memory) => {
    const lexical = memory.text.toLowerCase().split(/\W+/).filter((term) =>
      wanted.has(term)
    ).length;
    const semantic = similarity(embed(query), memory.embedding);
    return { ...memory, score: lexical + semantic, lexical, semantic };
  }).sort((left, right) => right.score - left.score).slice(0, limit);
}
export function compressMemories(memories: Memory[], maxItems: number): Memory[] {
  return [...memories].sort((left, right) =>
    right.importance - left.importance || right.createdAt - left.createdAt
  ).slice(0, maxItems);
}
export function forgetStale(memories: Memory[], now: number, maxAgeMs: number): Memory[] {
  return memories.filter((memory) =>
    now - memory.createdAt <= maxAgeMs || memory.importance >= 0.9
  );
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_architecture_demo",
    description:
      "Retrieve semantic, episodic, and procedural memories with compression and forgetting",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        memories: { type: "array" },
        limit: { type: "number" },
      },
      required: ["query", "memories"],
    },
  },
};
registerTool(definition, async (input) => {
  const raw = Array.isArray(input.memories)
    ? input.memories as Array<Omit<Memory, "embedding"> & { embedding?: number[] }>
    : [];
  const memories = raw.map((memory) => ({
    ...memory,
    embedding: memory.embedding ?? embed(memory.text),
  }));
  const fresh = forgetStale(memories, Date.now(), 30 * 24 * 60 * 60 * 1_000);
  return JSON.stringify({
    retrieval: hybridMemorySearch(String(input.query), fresh, undefined, Number(input.limit) || 5),
    compressed: compressMemories(fresh, 20).length,
  });
});
registerSystemPromptSection({
  id: "s44-memory-architecture",
  title: "Memory architecture",
  priority: 25,
  content:
    "Separate semantic facts, episodic experiences, and procedural strategies. Retrieve with lexical plus vector signals, preserve entity relationships, compress redundant memories, and forget stale low-importance items while protecting critical facts.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(embed("memory"));
  const query = prompt("s44 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
