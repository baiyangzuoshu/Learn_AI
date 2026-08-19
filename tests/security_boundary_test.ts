import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setAppDataPath } from "../src/platform.ts";
import {
  checkSecurityBoundary,
  readSecurityAudit,
  redactSecrets,
} from "../src/security_boundary.ts";
import type { Principal } from "../src/contracts.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function workspace(): Promise<string> {
  const root = `/private/tmp/ai-agent-security-${crypto.randomUUID()}`;
  const path = join(root, "workspace");
  await mkdir(path, { recursive: true });
  setAppDataPath(join(root, "app-data"));
  return path;
}

function principal(overrides: Partial<Principal> = {}): Principal {
  return {
    id: "principal-1",
    subject: "agent-1",
    tenant: "tenant-a",
    scopes: new Set(["external", "read"]),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

Deno.test("security boundary allows scoped HTTPS and redacts secrets", async () => {
  const path = await workspace();
  const result = await checkSecurityBoundary(path, {
    scope: "external",
    tenant: "tenant-a",
    url: "https://api.example.test/v1",
    text: "api_key=sk-secret-value bearer token123 password=hunter2",
  }, principal());
  assertEquals(result.audit.allowed, true);
  assert(result.redactedText?.includes("[REDACTED]"), "secret was not redacted");
  assertEquals((await readSecurityAudit(path)).length, 1);
});

Deno.test("security boundary denies scope, tenant, expiry, and private SSRF", async () => {
  const path = await workspace();
  const cases = [
    { scope: "dangerous", tenant: "tenant-a", url: "https://api.example.test" },
    { scope: "external", tenant: "tenant-b", url: "https://api.example.test" },
    { scope: "external", tenant: "tenant-a", url: "http://169.254.169.254/latest" },
  ];
  for (const input of cases) {
    let denied = false;
    try {
      await checkSecurityBoundary(path, input, principal());
    } catch {
      denied = true;
    }
    assert(denied, `security check unexpectedly allowed ${input.url}`);
  }
  let expired = false;
  try {
    await checkSecurityBoundary(path, {
      scope: "external",
      url: "https://api.example.test",
    }, principal({ expiresAt: Date.now() - 1 }));
  } catch {
    expired = true;
  }
  assert(expired, "expired principal was allowed");
  assertEquals((await readSecurityAudit(path)).length, 4);
});

Deno.test("redaction never returns the original credential formats", () => {
  const result = redactSecrets("sk-abc123 api-key=xyz bearer abc password=secret");
  assert(!result.includes("sk-abc123"), "API key leaked");
  assert(!result.includes("password=secret"), "password leaked");
});
