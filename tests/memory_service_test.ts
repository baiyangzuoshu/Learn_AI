import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setAppDataPath } from "../src/platform.ts";
import {
  migrateLegacyMemory,
  readMemoryRecords,
  searchMemory,
  tombstoneMemory,
  writeMemory,
} from "../src/memory_service.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

Deno.test("memory search is tenant-scoped, typed, ranked, and idempotent", async () => {
  const root = `/private/tmp/ai-agent-memory-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  setAppDataPath(join(root, "app-data"));

  const first = await writeMemory(workspace, {
    tenant: "tenant-a",
    kind: "semantic",
    text: "MCP sessions require initialize before tools/list",
    source: "run-trace-1",
    idempotencyKey: "mcp-fact-1",
  });
  const duplicate = await writeMemory(workspace, {
    tenant: "tenant-a",
    kind: "episodic",
    text: "should not create a duplicate",
    idempotencyKey: "mcp-fact-1",
  });
  assertEquals(duplicate.id, first.id);

  await writeMemory(workspace, {
    tenant: "tenant-b",
    kind: "semantic",
    text: "MCP sessions belong to another tenant",
  });
  await writeMemory(workspace, {
    tenant: "tenant-a",
    kind: "procedural",
    text: "Use the worker lease before settling a job",
    expiresAt: Date.now() - 1,
  });

  const hits = await searchMemory(workspace, {
    tenant: "tenant-a",
    query: "MCP initialize",
  });
  assertEquals(hits.length, 1);
  assertEquals(hits[0]?.id, first.id);
  assert(hits[0]?.citation.source === "run-trace-1", "citation source missing");

  const otherTenantHits = await searchMemory(workspace, {
    tenant: "tenant-b",
    query: "MCP initialize",
  });
  assertEquals(otherTenantHits.length, 1);
  assertEquals(otherTenantHits[0]?.id === first.id, false);
});

Deno.test("memory tombstones remain auditable but disappear from retrieval", async () => {
  const root = `/private/tmp/ai-agent-memory-delete-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  setAppDataPath(join(root, "app-data"));

  const record = await writeMemory(workspace, {
    tenant: "tenant-delete",
    kind: "episodic",
    text: "A removable event",
  });
  const deleted = await tombstoneMemory(workspace, record.id, "tenant-delete", "delete-1");
  assertEquals(deleted.deleted, true);
  assertEquals(
    (await searchMemory(workspace, {
      tenant: "tenant-delete",
      query: "removable event",
    })).length,
    0,
  );
  assertEquals(
    (await readMemoryRecords(workspace, {
      tenant: "tenant-delete",
      includeDeleted: true,
    })).length,
    1,
  );
  const repeated = await tombstoneMemory(workspace, record.id, "tenant-delete", "delete-1");
  assertEquals(repeated.revision, deleted.revision);
});

Deno.test("legacy Markdown memory migrates once into typed memory", async () => {
  const root = `/private/tmp/ai-agent-memory-migration-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(join(root, "app-data", "memory"), { recursive: true });
  await mkdir(workspace, { recursive: true });
  setAppDataPath(join(root, "app-data"));
  const path = join(root, "app-data", "memory", `${await workspaceKey(workspace)}.md`);
  await Deno.writeTextFile(path, "- legacy fact\n- another fact\n");

  const first = await migrateLegacyMemory(workspace);
  assertEquals(first.migrated, true);
  assertEquals(first.record?.tenant, "legacy");
  const second = await migrateLegacyMemory(workspace);
  assertEquals(second.migrated, false);
  assertEquals(second.record?.id, first.record?.id);
  assertEquals((await readMemoryRecords(workspace, { tenant: "legacy" })).length, 1);
});
