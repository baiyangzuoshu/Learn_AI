import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import {
  migrateLegacyMemory,
  readMemoryRecords,
  searchMemory,
  tombstoneMemory,
  writeMemory,
} from "../memory_service.ts";
import type { MemoryKind, MemoryRecord } from "../memory_service.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

function compact(record: MemoryRecord): Record<string, unknown> {
  return {
    id: record.id,
    tenant: record.tenant,
    kind: record.kind,
    text: record.text.slice(0, 800),
    source: record.source,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    deleted: record.deleted === true,
    revision: record.revision,
  };
}

export const memoryRag: HarnessFeature = {
  id: "memory-rag",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "memory_migrate_legacy",
        "Migrate legacy Markdown memory into typed Memory once",
        {},
        [],
      ),
      async (_input, context) => {
        const result = await migrateLegacyMemory(context.workspace, context.signal);
        return JSON.stringify({
          migrated: result.migrated,
          memory: result.record ? compact(result.record) : null,
        });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 20_000 },
    );
    tools.register(
      definition("memory_store", "Store tenant-scoped semantic, episodic, or procedural memory", {
        tenant: { type: "string" },
        kind: { type: "string", enum: ["semantic", "episodic", "procedural"] },
        text: { type: "string" },
        source: { type: "string" },
        expires_at: { type: "integer" },
        idempotency_key: { type: "string" },
      }, ["tenant", "kind", "text"]),
      async (input, context) => {
        const record = await writeMemory(context.workspace, {
          tenant: String(input.tenant ?? ""),
          kind: String(input.kind ?? "") as MemoryKind,
          text: String(input.text ?? ""),
          source: typeof input.source === "string" ? input.source : undefined,
          expiresAt: typeof input.expires_at === "number" ? input.expires_at : undefined,
          idempotencyKey: typeof input.idempotency_key === "string"
            ? input.idempotency_key
            : undefined,
        }, context.signal);
        return JSON.stringify({ memory: compact(record) });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 20_000 },
    );
    tools.register(
      definition(
        "memory_search",
        "Retrieve grounded tenant memory before using long-term context",
        {
          tenant: { type: "string" },
          query: { type: "string" },
          kind: { type: "string", enum: ["semantic", "episodic", "procedural"] },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        ["tenant", "query"],
      ),
      async (input, context) => {
        const hits = await searchMemory(context.workspace, {
          tenant: String(input.tenant ?? ""),
          query: String(input.query ?? ""),
          kind: typeof input.kind === "string" ? input.kind as MemoryKind : undefined,
          limit: typeof input.limit === "number" ? input.limit : undefined,
        }, context.signal);
        return JSON.stringify({
          retrievalMode: "lexical",
          hits,
          citations: hits.map((hit) => hit.citation),
        });
      },
    );
    tools.register(
      definition(
        "memory_tombstone",
        "Tombstone a tenant-scoped memory without deleting audit evidence",
        {
          id: { type: "string" },
          tenant: { type: "string" },
          idempotency_key: { type: "string" },
        },
        ["id", "tenant"],
      ),
      async (input, context) => {
        const record = await tombstoneMemory(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
          context.signal,
        );
        return JSON.stringify({ memory: compact(record) });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 20_000 },
    );
    tools.register(
      definition("memory_status", "Inspect tenant-scoped memory records and retention state", {
        tenant: { type: "string" },
        include_deleted: { type: "boolean" },
      }, ["tenant"]),
      async (input, context) => {
        const records = await readMemoryRecords(context.workspace, {
          tenant: String(input.tenant ?? ""),
          includeDeleted: input.include_deleted === true,
        });
        return JSON.stringify({ records: records.slice(0, 50).map(compact) });
      },
    );
    prompts.register({
      id: "memory-rag",
      title: "RAG and tenant memory",
      priority: 39,
      content:
        "Long-term memory is a bounded service, not an infinite chat history. Before relying on durable memory, call memory_search with the correct tenant and query, use only returned evidence and citations, and distinguish semantic, episodic, and procedural records. Never cross tenant boundaries, inject deleted or expired records, or claim a memory fact without a citation. Store stable non-secret facts with memory_store and use tombstones for deletion.",
    });
  },
};
