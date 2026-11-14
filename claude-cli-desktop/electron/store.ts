import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AppSettings, AutoCompactionRecord, ChatMessage, PermissionMode, SessionSummary } from "./contracts.js";
import { desktopPlatform } from "./platform.js";

const SETTINGS_FILE = "settings.json";
const SESSIONS_FILE = "sessions.json";
const SECRET_FILE = "secrets/deepseek-api-key";
const LEGACY_SECRET_FILE = "secrets/deepseek-api-key.bin";
const MAX_SESSIONS = 80;
const MAX_MESSAGES_PER_SESSION = 160;
const MAX_MESSAGE_LENGTH = 60_000;

export const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: "https://api.deepseek.com/anthropic",
  model: "deepseek-flash",
  permissionMode: "default",
};

export interface StoredSession extends SessionSummary {
  titleIsCustom: boolean;
  messages: ChatMessage[];
}

let dataDirectory = "";
let sessions: StoredSession[] = [];
let writeQueue: Promise<void> = Promise.resolve();

export async function initializeStore(directory: string): Promise<void> {
  dataDirectory = directory;
  await mkdir(dataDirectory, { recursive: true });
  sessions = await readSessions();
}

export async function readSettings(): Promise<AppSettings> {
  const stored = await readJson<Record<string, unknown>>(join(dataDirectory, SETTINGS_FILE));
  if (!stored) return { ...DEFAULT_SETTINGS };
  const storedModel = validateModel(stored.model, DEFAULT_SETTINGS.model);
  const settings = {
    baseUrl: validateBaseUrl(stored.baseUrl, DEFAULT_SETTINGS.baseUrl),
    model: storedModel === "deepseek-flash[1m]" ? DEFAULT_SETTINGS.model : storedModel,
    permissionMode: validatePermissionMode(stored.permissionMode),
  };
  if (settings.model !== storedModel) await writeSettings(settings);
  return settings;
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await atomicWrite(join(dataDirectory, SETTINGS_FILE), JSON.stringify(settings, null, 2));
}

export async function readApiKey(): Promise<string | undefined> {
  try {
    const apiKey = (await readFile(join(dataDirectory, SECRET_FILE), "utf8")).trim();
    return apiKey.length > 0 && apiKey.length <= 512 ? apiKey : undefined;
  } catch {
    return undefined;
  }
}

export async function hasLegacyApiKey(): Promise<boolean> {
  try {
    await access(join(dataDirectory, LEGACY_SECRET_FILE));
    return true;
  } catch {
    return false;
  }
}

export async function writeApiKey(apiKey: string): Promise<void> {
  const secretDirectory = join(dataDirectory, "secrets");
  await desktopPlatform.prepareSecretDirectory(secretDirectory);
  await atomicWrite(join(dataDirectory, SECRET_FILE), apiKey.trim());
  await unlink(join(dataDirectory, LEGACY_SECRET_FILE)).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}

export async function clearApiKey(): Promise<void> {
  for (const secretFile of [SECRET_FILE, LEGACY_SECRET_FILE]) {
    try {
      await unlink(join(dataDirectory, secretFile));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function listSessions(): SessionSummary[] {
  return [...sessions]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(({ id, title, cwd, createdAt, updatedAt }) => ({ id, title, cwd, createdAt, updatedAt }));
}

export function getSession(sessionId: string): StoredSession | undefined {
  return sessions.find((session) => session.id === sessionId);
}

export function getHistory(sessionId: string): ChatMessage[] {
  return getSession(sessionId)?.messages.map((message) => ({ ...message })) ?? [];
}

export async function createSession(cwd: string): Promise<SessionSummary> {
  const now = new Date().toISOString();
  const session: StoredSession = {
    id: crypto.randomUUID(),
    title: "新对话",
    titleIsCustom: false,
    cwd,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions.unshift(session);
  sessions = sessions.slice(0, MAX_SESSIONS);
  await persistSessions();
  return summaryOf(session);
}

export async function renameSession(sessionId: string, title: string): Promise<SessionSummary> {
  const session = getSession(sessionId);
  if (!session) throw new Error("找不到这个会话");
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  if (!normalizedTitle || normalizedTitle.length > 80) throw new Error("会话名称需为 1 到 80 个字符");
  session.title = normalizedTitle;
  session.titleIsCustom = true;
  await persistSessions();
  return summaryOf(session);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!getSession(sessionId)) throw new Error("找不到这个会话");
  sessions = sessions.filter((session) => session.id !== sessionId);
  await persistSessions();
}

export async function deleteProjectSessions(sessionId: string): Promise<number> {
  const project = getSession(sessionId);
  if (!project) throw new Error("找不到这个项目");
  const previousCount = sessions.length;
  sessions = sessions.filter((session) => session.cwd !== project.cwd);
  await persistSessions();
  return previousCount - sessions.length;
}

export async function addMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const session = getSession(sessionId);
  if (!session) throw new Error("找不到这个会话");
  const safeMessage: ChatMessage = {
    ...message,
    text: message.text.slice(0, MAX_MESSAGE_LENGTH),
  };
  session.messages.push(safeMessage);
  if (safeMessage.role === "user" && !session.titleIsCustom && session.title === "新对话") {
    session.title = safeMessage.text.trim().replace(/\s+/g, " ").slice(0, 48) || "新对话";
  }
  session.updatedAt = new Date().toISOString();
  session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
  await persistSessions();
}

export function appendAssistantText(sessionId: string, messageId: string, text: string): void {
  const message = getSession(sessionId)?.messages.find((candidate) => candidate.id === messageId);
  if (!message || message.role !== "assistant") return;
  message.text = `${message.text}${text}`.slice(0, MAX_MESSAGE_LENGTH);
  const session = getSession(sessionId);
  if (session) session.updatedAt = new Date().toISOString();
}

export function setAssistantDuration(
  sessionId: string,
  messageId: string,
  durationMs: number,
): void {
  const message = getSession(sessionId)?.messages.find((candidate) => candidate.id === messageId);
  if (!message || message.role !== "assistant" || !Number.isFinite(durationMs)) return;
  message.durationMs = Math.max(0, Math.min(durationMs, 24 * 60 * 60_000));
  const session = getSession(sessionId);
  if (session) session.updatedAt = new Date().toISOString();
}

export function setAssistantActivitySummary(
  sessionId: string,
  messageId: string,
  summary: string,
  count: number,
): void {
  const message = getSession(sessionId)?.messages.find((candidate) => candidate.id === messageId);
  if (!message || message.role !== "assistant" || !Number.isSafeInteger(count) || count < 0) return;
  message.activitySummary = summary.slice(0, 500);
  message.activityCount = Math.min(count, 10_000);
  const session = getSession(sessionId);
  if (session) session.updatedAt = new Date().toISOString();
}

export function setAssistantAutoCompaction(
  sessionId: string,
  messageId: string,
  count: number,
  lastCompaction: AutoCompactionRecord,
): void {
  const message = getSession(sessionId)?.messages.find((candidate) => candidate.id === messageId);
  if (
    !message || message.role !== "assistant" || !Number.isSafeInteger(count) || count < 1 ||
    !Number.isSafeInteger(lastCompaction.preTokens) || lastCompaction.preTokens < 0 ||
    (lastCompaction.postTokens !== undefined &&
      (!Number.isSafeInteger(lastCompaction.postTokens) || lastCompaction.postTokens < 0))
  ) return;
  message.autoCompactionCount = Math.min(count, 10_000);
  message.lastAutoCompaction = {
    preTokens: lastCompaction.preTokens,
    ...(lastCompaction.postTokens !== undefined ? { postTokens: lastCompaction.postTokens } : {}),
  };
  const session = getSession(sessionId);
  if (session) session.updatedAt = new Date().toISOString();
}

export async function persistSessions(): Promise<void> {
  const snapshot = JSON.stringify(sessions, null, 2);
  writeQueue = writeQueue.catch(() => undefined).then(() => atomicWrite(join(dataDirectory, SESSIONS_FILE), snapshot));
  await writeQueue;
}

export function validateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") throw new Error("设置格式不正确");
  const settings = value as Record<string, unknown>;
  if (typeof settings.baseUrl !== "string") throw new Error("API 地址格式不正确");
  let url: URL;
  try {
    url = new URL(settings.baseUrl.trim());
  } catch {
    throw new Error("API 地址格式不正确");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("API 地址必须使用 HTTPS，且不能包含账号或密码");
  }
  if (typeof settings.model !== "string" || !/^[a-zA-Z0-9._:[\]-]{1,160}$/.test(settings.model.trim())) {
    throw new Error("模型名称只能包含英文字母、数字、点、下划线、冒号、方括号和连字符");
  }
  if (
    settings.permissionMode !== "default" &&
    settings.permissionMode !== "acceptEdits" &&
    settings.permissionMode !== "bypassPermissions"
  ) {
    throw new Error("权限模式无效");
  }
  return {
    baseUrl: url.toString().replace(/\/$/, ""),
    model: settings.model.trim(),
    permissionMode: settings.permissionMode,
  };
}

function validateBaseUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 500) return fallback;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return fallback;
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function validateModel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const model = value.trim();
  return model.length > 0 && model.length <= 160 && /^[a-zA-Z0-9._:[\]-]+$/.test(model)
    ? model
    : fallback;
}

function validatePermissionMode(value: unknown): PermissionMode {
  return value === "acceptEdits" || value === "bypassPermissions" ? value : "default";
}

async function readSessions(): Promise<StoredSession[]> {
  const stored = await readJson<unknown>(join(dataDirectory, SESSIONS_FILE));
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((value): StoredSession[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(item.id) ||
      typeof item.cwd !== "string" ||
      typeof item.createdAt !== "string" ||
      typeof item.updatedAt !== "string"
    ) return [];
    const messages = Array.isArray(item.messages)
      ? item.messages.flatMap((message): ChatMessage[] => {
          if (!message || typeof message !== "object") return [];
          const record = message as Record<string, unknown>;
          if (
            typeof record.id !== "string" ||
            (record.role !== "user" && record.role !== "assistant" && record.role !== "tool") ||
            typeof record.text !== "string" ||
            typeof record.createdAt !== "string"
          ) return [];
          return [{
            id: record.id,
            role: record.role,
            text: record.text.slice(0, MAX_MESSAGE_LENGTH),
            createdAt: record.createdAt,
            ...(typeof record.toolName === "string" ? { toolName: record.toolName.slice(0, 120) } : {}),
            ...(typeof record.durationMs === "number" && Number.isFinite(record.durationMs) &&
                record.durationMs >= 0 && record.durationMs <= 24 * 60 * 60_000
              ? { durationMs: record.durationMs }
              : {}),
            ...(typeof record.activitySummary === "string" && record.activitySummary.length <= 500
              ? { activitySummary: record.activitySummary }
              : {}),
            ...(typeof record.activityCount === "number" && Number.isSafeInteger(record.activityCount) &&
                record.activityCount >= 0 && record.activityCount <= 10_000
              ? { activityCount: record.activityCount }
              : {}),
            ...(typeof record.autoCompactionCount === "number" && Number.isSafeInteger(record.autoCompactionCount) &&
                record.autoCompactionCount > 0 && record.autoCompactionCount <= 10_000
              ? { autoCompactionCount: record.autoCompactionCount }
              : {}),
            ...(record.lastAutoCompaction && typeof record.lastAutoCompaction === "object" &&
                Number.isSafeInteger((record.lastAutoCompaction as Record<string, unknown>).preTokens) &&
                ((record.lastAutoCompaction as Record<string, number>).preTokens >= 0) &&
                ((record.lastAutoCompaction as Record<string, unknown>).postTokens === undefined ||
                  (Number.isSafeInteger((record.lastAutoCompaction as Record<string, unknown>).postTokens) &&
                    (record.lastAutoCompaction as Record<string, number>).postTokens >= 0))
              ? {
                lastAutoCompaction: {
                  preTokens: (record.lastAutoCompaction as Record<string, number>).preTokens,
                  ...((record.lastAutoCompaction as Record<string, unknown>).postTokens !== undefined
                    ? { postTokens: (record.lastAutoCompaction as Record<string, number>).postTokens }
                    : {}),
                },
              }
              : {}),
          }];
        }).slice(-MAX_MESSAGES_PER_SESSION)
      : [];
    return [{
      id: item.id,
      cwd: item.cwd,
      title: typeof item.title === "string" ? item.title.slice(0, 80) : "新对话",
      titleIsCustom: item.titleIsCustom === true,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      messages,
    }];
  }).slice(0, MAX_SESSIONS);
}

function summaryOf(session: StoredSession): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    cwd: session.cwd,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return undefined;
  }
}

async function atomicWrite(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, data, { mode: 0o600 });
  await rename(temporaryPath, path);
}
