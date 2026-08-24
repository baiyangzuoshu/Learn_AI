import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setAppDataPath } from "../src/platform.ts";
import {
  addResearchSource,
  readResearch,
  startResearch,
  synthesizeResearch,
} from "../src/research_service.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function workspace(): Promise<{ root: string; path: string }> {
  const root = `/private/tmp/ai-agent-research-${crypto.randomUUID()}`;
  const path = join(root, "workspace");
  await mkdir(path, { recursive: true });
  setAppDataPath(join(root, "app-data"));
  return { root, path };
}

Deno.test("research is idempotent, tenant-scoped, and synthesizes citations", async () => {
  const { path } = await workspace();
  const first = await startResearch(path, {
    tenant: "tenant-research",
    query: "What is the current policy?",
    traceId: "trace-research-1",
    minConfidence: 0.6,
    idempotencyKey: "start-1",
  });
  const duplicate = await startResearch(path, {
    tenant: "tenant-research",
    query: "different query is ignored on retry",
    idempotencyKey: "start-1",
  });
  assertEquals(duplicate.id, first.id);

  const source = await addResearchSource(path, first.id, {
    tenant: "tenant-research",
    url: "https://example.com/policy",
    title: "Policy source",
    text: "The policy requires an explicit evidence checkpoint.",
    fetchedAt: new Date().toISOString(),
    quality: 0.95,
    idempotencyKey: "source-1",
  });
  assertEquals(source.sources.length, 1);
  const result = await synthesizeResearch(path, first.id, "tenant-research");
  assertEquals(result.state, "complete");
  assert(result.citations.includes("https://example.com/policy"), "citation missing");
  assert(result.answer?.includes("evidence checkpoint"), "grounded answer missing");
  assertEquals((await readResearch(path, { tenant: "other-tenant" })).length, 0);
});

Deno.test("research escalates when every source is stale or below quality", async () => {
  const { path } = await workspace();
  const record = await startResearch(path, {
    tenant: "tenant-escalate",
    query: "Need a verified answer",
    freshnessHours: 1,
    minConfidence: 0.5,
  });
  await addResearchSource(path, record.id, {
    tenant: "tenant-escalate",
    url: "https://example.com/stale",
    title: "Stale source",
    text: "Old information",
    fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString(),
    quality: 0.99,
  });
  const result = await synthesizeResearch(path, record.id, "tenant-escalate");
  assertEquals(result.state, "escalated");
  assertEquals(result.citations.length, 0);
  assert(result.escalationReason?.includes("没有新鲜"), "escalation reason missing");
});

Deno.test("research rejects non-HTTPS remote sources and tenant mismatch", async () => {
  const { path } = await workspace();
  const record = await startResearch(path, { tenant: "tenant-safe", query: "safe sources" });
  let rejected = false;
  try {
    await addResearchSource(path, record.id, {
      tenant: "tenant-safe",
      url: "http://example.com/not-allowed",
      title: "Unsafe",
      text: "blocked",
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "remote HTTP source was accepted");
  let mismatch = false;
  try {
    await synthesizeResearch(path, record.id, "other-tenant");
  } catch {
    mismatch = true;
  }
  assert(mismatch, "tenant mismatch was accepted");
});
