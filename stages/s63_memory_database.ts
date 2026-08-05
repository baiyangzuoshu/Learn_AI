import { type AgentEvent, agentLoop as previousAgentLoop } from "./s62_a2a_network_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type MemoryKind = "semantic" | "episodic" | "procedural";
export type MemoryRecord = {
  id: string;
  tenant: string;
  kind: MemoryKind;
  text: string;
  version: number;
  deleted?: boolean;
  updatedAt: string;
};
export interface MemoryPersistence {
  load(): Promise<{ schema: number; records: MemoryRecord[] }>;
  save(snapshot: { schema: number; records: MemoryRecord[] }): Promise<void>;
}

export class JsonFilePersistence implements MemoryPersistence {
  constructor(private readonly path: string, private readonly schema = 1) {}
  async load() {
    try {
      const parsed = JSON.parse(await Deno.readTextFile(this.path)) as {
        schema?: number;
        records?: MemoryRecord[];
      };
      return {
        schema: Number(parsed.schema ?? 0),
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return { schema: this.schema, records: [] };
      throw error;
    }
  }
  async save(snapshot: { schema: number; records: MemoryRecord[] }) {
    const temporary = `${this.path}.tmp-${crypto.randomUUID()}`;
    await Deno.mkdir(this.path.slice(0, this.path.lastIndexOf("/")), { recursive: true });
    await Deno.writeTextFile(temporary, JSON.stringify(snapshot));
    await Deno.rename(temporary, this.path);
  }
}

export class MemoryDatabase {
  private snapshot = { schema: 1, records: [] as MemoryRecord[] };
  private ready: Promise<void>;
  constructor(private readonly persistence: MemoryPersistence) {
    this.ready = this.load();
  }
  private async load() {
    const loaded = await this.persistence.load();
    this.snapshot = { schema: Math.max(1, loaded.schema), records: loaded.records };
  }
  private async transaction(mutator: () => void) {
    await this.ready;
    mutator();
    await this.persistence.save(this.snapshot);
  }
  async put(record: Omit<MemoryRecord, "version" | "updatedAt">) {
    await this.transaction(() => {
      const previous = this.snapshot.records.find((item) => item.id === record.id);
      this.snapshot.records = this.snapshot.records.filter((item) => item.id !== record.id);
      this.snapshot.records.push({
        ...record,
        version: (previous?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async search(tenant: string, query: string, limit = 5) {
    await this.ready;
    const terms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    return this.snapshot.records.filter((record) => record.tenant === tenant && !record.deleted)
      .map((record) => ({
        record,
        score: [...terms].filter((term) => record.text.toLowerCase().includes(term)).length,
      }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  async delete(tenant: string, id: string) {
    await this.transaction(() => {
      const record = this.snapshot.records.find((item) => item.id === id && item.tenant === tenant);
      if (record) record.deleted = true;
    });
  }
  async migrate(targetSchema: number) {
    await this.transaction(() => {
      this.snapshot.schema = Math.max(this.snapshot.schema, targetSchema);
    });
    return this.snapshot.schema;
  }
}

class MemoryPersistenceForLesson implements MemoryPersistence {
  private value = { schema: 1, records: [] as MemoryRecord[] };
  async load() {
    return structuredClone(this.value);
  }
  async save(snapshot: { schema: number; records: MemoryRecord[] }) {
    this.value = structuredClone(snapshot);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_database_runtime",
    description:
      "Write versioned tenant memory, retrieve relevant records, migrate, and tombstone-delete",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const database = new MemoryDatabase(new MemoryPersistenceForLesson());
  await database.put({
    id: "m1",
    tenant: "tenant-a",
    kind: "semantic",
    text: "MCP memory is tenant scoped",
  });
  await database.put({ id: "m2", tenant: "tenant-b", kind: "episodic", text: "private memory" });
  const hits = await database.search("tenant-a", String(input.query));
  await database.delete("tenant-a", "m1");
  return JSON.stringify({ hits, schema: await database.migrate(2) });
});
registerSystemPromptSection({
  id: "s63-memory-database",
  title: "Durable memory database",
  priority: 44,
  content:
    "Memory writes are versioned transactions. Retrieval is tenant-scoped, deletion is a tombstone, snapshots are atomically replaced, and migrations are explicit.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s63 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
