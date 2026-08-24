import type { Principal } from "./contracts.ts";
import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export interface SecurityAuditEntry {
  action: string;
  allowed: boolean;
  reason: string;
  subject: string;
  tenant: string;
  host?: string;
  at: string;
}

export interface SecurityCheckInput {
  scope: string;
  url: string;
  tenant?: string;
  text?: string;
}

const MAX_AUDIT = 200;
const MAX_SCOPE = 120;
const MAX_TENANT = 240;
const MAX_TEXT = 12_000;
const locks = new Map<string, Promise<void>>();

function value(input: unknown, name: string, max: number): string {
  const result = String(input ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} 无效`);
  }
  return result;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (
    parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
}

function isPrivateHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/[\[\]]/g, "");
  if (isPrivateIpv4(normalized)) return true;
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function safeUrl(raw: string): { url: URL; host: string } {
  let url: URL;
  try {
    url = new URL(value(raw, "url", 2_000));
  } catch {
    throw new Error("url 无效");
  }
  if (url.username || url.password) throw new Error("URL 不得包含凭据");
  const normalizedHost = url.hostname.toLowerCase().replace(/[\[\]]/g, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(normalizedHost);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("出口只允许 HTTPS 或 localhost HTTP");
  }
  if (!local && isPrivateHost(normalizedHost)) throw new Error("出口地址命中 SSRF 私有网段");
  return { url, host: normalizedHost };
}

export function redactSecrets(raw: string): string {
  const text = String(raw ?? "").slice(0, MAX_TEXT);
  return text
    .replace(/(?:sk-[A-Za-z0-9_-]+|api[_-]?key\s*[:=]\s*\S+)/gi, "[REDACTED]")
    .replace(
      /(?:bearer\s+|token\s*[:=]\s*|password\s*[:=]\s*|secret\s*[:=]\s*)\S+/gi,
      "[REDACTED]",
    );
}

async function auditPath(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const key = [...new Uint8Array(digest)].slice(0, 12).map((item) =>
    item.toString(16).padStart(2, "0")
  ).join("");
  return `${appDataDir()}/security/${key}.json`;
}

async function readAudit(workspace: string): Promise<SecurityAuditEntry[]> {
  try {
    const value = JSON.parse(await readUtf8(await auditPath(workspace))) as unknown;
    if (!Array.isArray(value) || value.length > MAX_AUDIT) {
      throw new Error("security audit 存储无效");
    }
    return value as SecurityAuditEntry[];
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function withLock<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(workspace) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => release = resolve);
  locks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(workspace) === current) locks.delete(workspace);
  }
}

export async function checkSecurityBoundary(
  workspace: string,
  input: SecurityCheckInput,
  principal: Principal,
  signal?: AbortSignal,
): Promise<{ audit: SecurityAuditEntry; redactedText?: string }> {
  if (signal?.aborted) throw new DOMException("Security check cancelled", "AbortError");
  const scope = value(input.scope, "scope", MAX_SCOPE);
  const expectedTenant = input.tenant ? value(input.tenant, "tenant", MAX_TENANT) : undefined;
  const subject = value(principal.subject ?? principal.id, "subject", 240);
  const tenant = value(principal.tenant ?? "local", "tenant", MAX_TENANT);
  let host: string | undefined;
  let allowed = true;
  let reason = "allowed";
  try {
    if (expectedTenant && expectedTenant !== tenant) throw new Error("tenant 不匹配");
    if (principal.expiresAt <= Date.now()) throw new Error("identity 已过期");
    if (!principal.scopes.has(scope)) throw new Error("identity scope 不足");
    host = safeUrl(input.url).host;
  } catch (error) {
    allowed = false;
    reason = error instanceof Error ? error.message : String(error);
  }
  const audit: SecurityAuditEntry = {
    action: scope,
    allowed,
    reason,
    subject,
    tenant,
    host,
    at: new Date().toISOString(),
  };
  await withLock(workspace, async () => {
    const records = await readAudit(workspace);
    records.push(audit);
    await writeJsonAtomic(await auditPath(workspace), records.slice(-MAX_AUDIT));
  });
  if (!allowed) throw new Error(`security boundary denied: ${reason}`);
  return {
    audit,
    redactedText: input.text === undefined ? undefined : redactSecrets(input.text),
  };
}

export async function readSecurityAudit(
  workspace: string,
  limit = 50,
): Promise<SecurityAuditEntry[]> {
  const records = await readAudit(workspace);
  return records.slice(-Math.max(1, Math.min(MAX_AUDIT, Math.trunc(limit))));
}
