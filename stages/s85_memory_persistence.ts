import { type AgentEvent, agentLoop as previousAgentLoop } from "./s84_a2a_gateway.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type StoredMemory = {
  id: string;
  tenant: string;
  kind: "semantic" | "episodic" | "procedural";
  text: string;
  version: number;
  deleted?: boolean;
  updatedAt: string;
};
export interface MemoryPathProvider {
  path(tenant: string): string;
}
export class AtomicMemoryStore {
  private readonly locks = new Map<string, Promise<void>>();
  constructor(private readonly paths: MemoryPathProvider) {}
  private async withLock<T>(key: string, work: () => Promise<T>) {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => release = resolve);
    this.locks.set(key, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
  async read(tenant: string): Promise<StoredMemory[]> {
    try {
      const value = JSON.parse(await Deno.readTextFile(this.paths.path(tenant))) as {
        records?: StoredMemory[];
      };
      return Array.isArray(value.records) ? value.records : [];
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return [];
      throw error;
    }
  }
  async put(record: Omit<StoredMemory, "version" | "updatedAt">) {
    return await this.withLock(record.tenant, async () => {
      const records = await this.read(record.tenant),
        old = records.find((item) => item.id === record.id),
        next = records.filter((item) => item.id !== record.id);
      next.push({
        ...record,
        version: (old?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      const path = this.paths.path(record.tenant), temporary = `${path}.tmp-${crypto.randomUUID()}`;
      await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      await Deno.writeTextFile(temporary, JSON.stringify({ schema: 1, records: next }));
      await Deno.rename(temporary, path);
    });
  }
  async tombstone(tenant: string, id: string) {
    const records = await this.read(tenant), record = records.find((item) => item.id === id);
    if (record) {
      record.deleted = true;
      await this.put(record);
    }
  }
}

class LessonPaths implements MemoryPathProvider {
  private readonly pathValue = "/tmp/s85-memory.json";
  path() {
    return this.pathValue;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_persistence",
    description:
      "Persist tenant memory with atomic replacement, versioning, locking, and tombstones",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const store = new AtomicMemoryStore(new LessonPaths());
  await store.put({ id: "lesson", tenant: "demo", kind: "semantic", text: String(input.text) });
  return JSON.stringify(await store.read("demo"));
});
registerSystemPromptSection({
  id: "s85-memory-persistence",
  title: "Atomic Memory persistence",
  priority: 66,
  content:
    "Long-term memory uses application paths, tenant-scoped atomic snapshots, serialized writes, schema versions, and tombstones. Memory data is never silently mixed with conversation history.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s85 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
