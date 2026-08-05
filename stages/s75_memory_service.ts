import { type AgentEvent, agentLoop as previousAgentLoop } from "./s74_a2a_service_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type MemoryItem = {
  id: string;
  tenant: string;
  kind: "semantic" | "episodic" | "procedural";
  text: string;
  vector: number[];
  expiresAt?: number;
};
export interface MemoryBackend {
  list(tenant: string): Promise<MemoryItem[]>;
  put(item: MemoryItem): Promise<void>;
}
function embed(text: string, size = 8) {
  const vector = Array.from({ length: size }, () => 0);
  for (const [index, char] of [...text.toLowerCase()].entries()) {
    vector[index % size] += char.charCodeAt(0) / 255;
  }
  return vector;
}
function cosine(a: number[], b: number[]) {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0),
    na = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0)),
    nb = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return na && nb ? dot / (na * nb) : 0;
}
class LessonBackend implements MemoryBackend {
  private readonly items: MemoryItem[] = [];
  async list(tenant: string) {
    return this.items.filter((item) => item.tenant === tenant);
  }
  async put(item: MemoryItem) {
    this.items.push(structuredClone(item));
  }
}

export class HybridMemoryService {
  constructor(private readonly backend: MemoryBackend, private readonly now = () => Date.now()) {}
  async remember(item: Omit<MemoryItem, "vector">) {
    await this.backend.put({ ...item, vector: embed(item.text) });
  }
  async retrieve(tenant: string, query: string, limit = 5) {
    const queryVector = embed(query),
      terms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    return (await this.backend.list(tenant)).filter((item) =>
      !item.expiresAt || item.expiresAt > this.now()
    ).map((item) => {
      const lexical = [...terms].filter((term) => item.text.toLowerCase().includes(term)).length /
        Math.max(1, terms.size);
      return { item, score: lexical * 0.4 + cosine(queryVector, item.vector) * 0.6 };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_service",
    description:
      "Store tenant-scoped typed memory and retrieve it with hybrid lexical/vector ranking",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const service = new HybridMemoryService(new LessonBackend());
  await service.remember({
    id: "m1",
    tenant: "a",
    kind: "semantic",
    text: "bounded runtime protects production",
    expiresAt: Date.now() + 60_000,
  });
  await service.remember({ id: "m2", tenant: "b", kind: "episodic", text: "private tenant event" });
  return JSON.stringify(await service.retrieve("a", String(input.query)));
});
registerSystemPromptSection({
  id: "s75-memory-service",
  title: "Production memory service",
  priority: 56,
  content:
    "Memory is tenant-scoped and typed. Retrieval combines lexical and vector evidence, filters expired records, and keeps long-term storage separate from the prompt window.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s75 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
