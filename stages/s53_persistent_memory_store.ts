import { type AgentEvent, agentLoop as previousAgentLoop } from "./s52_a2a_http_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type MemoryRecord = {
  id: string;
  tenant: string;
  kind: "semantic" | "episodic" | "procedural";
  text: string;
  tags: string[];
  importance: number;
  createdAt: string;
  deletedAt?: string;
};
export type MemorySnapshot = {
  version: 1;
  records: MemoryRecord[];
  edges: Array<{ from: string; to: string; relation: string }>;
};

function score(query: string, text: string): number {
  const wanted = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  return text.toLowerCase().split(/\W+/).filter((token) => wanted.has(token)).length;
}

export class PersistentMemoryStore {
  private snapshot: MemorySnapshot = { version: 1, records: [], edges: [] };
  constructor(readonly path: string) {}
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await Deno.readTextFile(this.path)) as MemorySnapshot;
      if (parsed.version !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.edges)) {
        throw new Error("invalid memory snapshot");
      }
      this.snapshot = parsed;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  async save(): Promise<void> {
    await Deno.mkdir(this.path.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
    const temporary = `${this.path}.tmp-${crypto.randomUUID()}`;
    await Deno.writeTextFile(temporary, `${JSON.stringify(this.snapshot, null, 2)}\n`);
    await Deno.rename(temporary, this.path);
  }
  upsert(record: MemoryRecord): void {
    const index = this.snapshot.records.findIndex((item) =>
      item.id === record.id && item.tenant === record.tenant
    );
    if (index >= 0) this.snapshot.records[index] = record;
    else this.snapshot.records.push(record);
  }
  link(from: string, to: string, relation: string): void {
    this.snapshot.edges.push({ from, to, relation });
  }
  search(tenant: string, query: string, limit = 5): MemoryRecord[] {
    return this.snapshot.records.filter((record) => record.tenant === tenant && !record.deletedAt)
      .map((record) => ({ record, score: score(query, record.text) })).filter((item) =>
        item.score > 0
      ).sort((a, b) => b.score - a.score || b.record.importance - a.record.importance).slice(
        0,
        limit,
      ).map((item) => item.record);
  }
  forget(predicate: (record: MemoryRecord) => boolean): number {
    let removed = 0;
    for (const record of this.snapshot.records) {
      if (!record.deletedAt && predicate(record)) {
        record.deletedAt = new Date().toISOString();
        removed++;
      }
    }
    return removed;
  }
  exportSnapshot(): MemorySnapshot {
    return structuredClone(this.snapshot);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "persistent_memory_store_demo",
    description: "Write, atomically persist, search, link, and tombstone tenant-scoped memories",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        tenant: { type: "string" },
        query: { type: "string" },
      },
      required: ["path", "tenant", "query"],
    },
  },
};
registerTool(definition, async (input) => {
  const store = new PersistentMemoryStore(String(input.path));
  await store.load();
  store.upsert({
    id: "memory-1",
    tenant: String(input.tenant),
    kind: "semantic",
    text: "permissions are checked before tools",
    tags: ["security"],
    importance: 0.9,
    createdAt: new Date().toISOString(),
  });
  await store.save();
  return JSON.stringify({
    results: store.search(String(input.tenant), String(input.query)),
    snapshot: store.exportSnapshot(),
  });
});
registerSystemPromptSection({
  id: "s53-persistent-memory-store",
  title: "Persistent memory store",
  priority: 34,
  content:
    "Persist memory through validated versioned snapshots, atomic temp-file rename, tenant filtering, graph links, and tombstone deletion. Retrieval must distinguish live records from deleted or stale memory.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const path = "/tmp/s53-memory.json";
  console.log(path);
  const query = prompt("s53 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
