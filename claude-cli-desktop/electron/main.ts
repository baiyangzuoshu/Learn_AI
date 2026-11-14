import { createRequire } from "node:module";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { AppEvent, AppSettings, AutoCompactionRecord, ChatMessage } from "./contracts.js";
import { inspectClaudeCli } from "./claude-cli.js";
import { desktopPlatform } from "./platform.js";
import {
  addMessage,
  appendAssistantText,
  clearApiKey,
  createSession,
  deleteSession,
  deleteProjectSessions,
  getHistory,
  getSession,
  hasLegacyApiKey,
  initializeStore,
  listSessions,
  persistSessions,
  readApiKey,
  readSettings,
  renameSession,
  setAssistantAutoCompaction,
  setAssistantActivitySummary,
  setAssistantDuration,
  validateSettings,
  writeApiKey,
  writeSettings,
} from "./store.js";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, dialog, ipcMain } = require("electron") as typeof import("electron");
type BrowserWindowInstance = import("electron").BrowserWindow;

const MAX_CONCURRENT_TURNS = 1;
const MAX_PROMPT_LENGTH = 30_000;
const MAX_PERMISSION_PREVIEW = 5_000;
const MAX_AGENTIC_TURNS = 40;
const TOOL_IDLE_TIMEOUT_MS = 10 * 60_000;
const appDataDirectory = join(app.getPath("appData"), "Claude CLI Studio");

interface ActiveTurn {
  sessionId: string;
  messageId: string;
  startedAt: number;
  senderId: number;
  permissionMode: AppSettings["permissionMode"];
  abortController: AbortController;
  query?: ReturnType<typeof query>;
  stopRequested: boolean;
  toolActionCounts: Map<string, number>;
  autoCompactionCount: number;
  lastAutoCompaction?: AutoCompactionRecord;
  task: Promise<void>;
}

interface PendingPermission {
  sessionId: string;
  senderId: number;
  toolUseId: string;
  toolName: string;
  resolve: (result: PermissionResult) => void;
  abort: () => void;
}

const activeTurns = new Map<string, ActiveTurn>();
const startingTurns = new Set<string>();
const pendingPermissions = new Map<string, PendingPermission>();
const deletingWorkspaces = new Set<string>();
const windows = new Set<BrowserWindowInstance>();
let shuttingDown = false;

app.setName("Claude CLI Studio");
app.setPath("userData", appDataDirectory);

function emit(senderId: number, event: AppEvent): void {
  for (const window of windows) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    if (window.webContents.id === senderId) {
      window.webContents.send("app:event", event);
      return;
    }
  }
}

function sanitizeError(error: unknown, apiKey?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const withoutKey = apiKey ? raw.split(apiKey).join("[已隐藏]") : raw;
  const safe = withoutKey.replace(/sk-[A-Za-z0-9_-]{12,}/g, "[已隐藏]");
  return safe.slice(0, 800) || "发生了未知错误";
}

function sanitizeDiagnosticText(value: unknown, apiKey?: string): string {
  return sanitizeError(value, apiKey)
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\b(Bearer)\s+[^\s,;]+/gi, "$1 [已隐藏]")
    .replace(/\b(ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|x-api-key|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[已隐藏]")
    .replace(/\s+/g, " ")
    .slice(0, 800);
}

function describeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.origin + url.pathname;
  } catch {
    return "[无效的 API 地址]";
  }
}

function emitDiagnostic(
  senderId: number,
  sessionId: string,
  level: "info" | "warn" | "error",
  message: string,
  apiKey?: string,
): void {
  const safeMessage = sanitizeDiagnosticText(message, apiKey);
  if (!safeMessage) return;
  emit(senderId, {
    type: "diagnostic-log",
    sessionId,
    timestamp: new Date().toISOString(),
    level,
    message: safeMessage,
  });
}

function previewInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 2).slice(0, MAX_PERMISSION_PREVIEW);
  } catch {
    return "无法显示工具参数";
  }
}

function describeToolAction(toolName: string): string {
  switch (toolName) {
    case "Bash": return "运行命令";
    case "Read": return "读取文件";
    case "Glob": return "搜索文件";
    case "Grep": return "搜索代码";
    case "Edit": return "修改文件";
    case "Write": return "写入文件";
    case "NotebookEdit": return "编辑笔记本";
    case "WebSearch": return "搜索网页";
    case "WebFetch": return "读取网页";
    case "LS": return "查看目录";
    default: return "执行操作";
  }
}

function summarizeToolActions(counts: Map<string, number>): string {
  return [...counts].map(([action, count]) => `${action} ${count}`).join(" · ").slice(0, 500);
}

function recordToolAction(active: ActiveTurn, toolName: string): { action: string; total: number; summary: string } {
  const action = describeToolAction(toolName);
  active.toolActionCounts.set(action, (active.toolActionCounts.get(action) ?? 0) + 1);
  const total = [...active.toolActionCounts.values()].reduce((sum, count) => sum + count, 0);
  return { action, total, summary: summarizeToolActions(active.toolActionCounts) };
}

function persistToolActivity(active: ActiveTurn): {
  summary: string;
  count: number;
  autoCompactionCount: number;
  lastAutoCompaction?: AutoCompactionRecord;
} {
  const summary = summarizeToolActions(active.toolActionCounts);
  const count = Math.min(10_000, [...active.toolActionCounts.values()].reduce((sum, value) => sum + value, 0));
  if (count > 0) setAssistantActivitySummary(active.sessionId, active.messageId, summary, count);
  if (active.autoCompactionCount > 0 && active.lastAutoCompaction) {
    setAssistantAutoCompaction(
      active.sessionId,
      active.messageId,
      active.autoCompactionCount,
      active.lastAutoCompaction,
    );
  }
  return {
    summary,
    count,
    autoCompactionCount: active.autoCompactionCount,
    ...(active.lastAutoCompaction ? { lastAutoCompaction: active.lastAutoCompaction } : {}),
  };
}

function activityEventFields(activity: {
  summary: string;
  count: number;
  autoCompactionCount: number;
  lastAutoCompaction?: AutoCompactionRecord;
}): {
  activitySummary?: string;
  activityCount?: number;
  autoCompactionCount?: number;
  lastAutoCompaction?: AutoCompactionRecord;
} {
  return {
    ...(activity.count > 0 ? { activitySummary: activity.summary, activityCount: activity.count } : {}),
    ...(activity.autoCompactionCount > 0
      ? {
        autoCompactionCount: activity.autoCompactionCount,
        ...(activity.lastAutoCompaction ? { lastAutoCompaction: activity.lastAutoCompaction } : {}),
      }
      : {}),
  };
}

function assertIpcSender(senderId: number): void {
  const window = [...windows].find((candidate) => !candidate.isDestroyed() && candidate.webContents.id === senderId);
  if (!window) throw new Error("无效的桌面窗口请求");
}

function closeActiveQuery(active: ActiveTurn): void {
  active.abortController.abort();
  active.query?.close();
}

function isFileEditTool(toolName: string): boolean {
  return toolName === "Edit" || toolName === "Write" || toolName === "NotebookEdit";
}

function autoApproves(mode: AppSettings["permissionMode"], toolName: string): boolean {
  return mode === "bypassPermissions" || (mode === "acceptEdits" && isFileEditTool(toolName));
}

function applyPermissionMode(mode: AppSettings["permissionMode"]): void {
  for (const active of activeTurns.values()) active.permissionMode = mode;
  for (const [requestId, pending] of pendingPermissions) {
    const active = activeTurns.get(pending.sessionId);
    if (active && autoApproves(mode, pending.toolName)) {
      pending.resolve({ behavior: "allow", toolUseID: pending.toolUseId });
      pendingPermissions.delete(requestId);
    }
  }
}

function makePermissionHandler(active: ActiveTurn): CanUseTool {
  return async (toolName, input, options): Promise<PermissionResult> => {
    const requestId = crypto.randomUUID();
    if (options.signal.aborted || shuttingDown) {
      return { behavior: "deny" as const, message: "请求已取消", toolUseID: options.toolUseID };
    }
    if (autoApproves(active.permissionMode, toolName)) {
      return { behavior: "allow", toolUseID: options.toolUseID };
    }
    return await new Promise<PermissionResult>((resolve) => {
      const deny = () => resolve({ behavior: "deny", message: "请求已取消", toolUseID: options.toolUseID });
      const abort = () => {
        pendingPermissions.delete(requestId);
        deny();
      };
      const window = [...windows].find((candidate) => !candidate.isDestroyed() && candidate.webContents.id === active.senderId);
      if (!window || window.webContents.isDestroyed()) {
        deny();
        return;
      }
      options.signal.addEventListener("abort", abort, { once: true });
      pendingPermissions.set(requestId, {
        sessionId: active.sessionId,
        senderId: active.senderId,
        toolUseId: options.toolUseID,
        toolName,
        resolve: (result) => {
          options.signal.removeEventListener("abort", abort);
          pendingPermissions.delete(requestId);
          resolve(result);
        },
        abort,
      });
      emit(active.senderId, {
        type: "permission-request",
        sessionId: active.sessionId,
        requestId,
        toolUseId: options.toolUseID,
        toolName: toolName.slice(0, 120),
        inputPreview: previewInput(input),
      });
    });
  };
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "Claude CLI Studio",
    backgroundColor: "#f4f4f1",
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  windows.add(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("closed", () => {
    windows.delete(window);
    for (const [requestId, permission] of pendingPermissions) {
      if (permission.senderId === window.webContents.id) {
        permission.abort();
        pendingPermissions.delete(requestId);
      }
    }
  });
  await window.loadFile(join(app.getAppPath(), "dist", "renderer", "index.html"));
}

function registerHandlers(): void {
  ipcMain.handle("app:bootstrap", async (event) => {
    assertIpcSender(event.sender.id);
    const [settings, apiKey, cli, legacyApiKeyPresent] = await Promise.all([
      readSettings(),
      readApiKey(),
      inspectClaudeCli(),
      hasLegacyApiKey(),
    ]);
    return {
      settings,
      hasApiKey: Boolean(apiKey),
      legacyApiKeyPresent,
      ...(cli ? { cliPath: cli.path, cliVersion: cli.version } : { cliError: "没有找到 Claude Code CLI。请先安装 Claude Code，然后重新打开应用。" }),
      sessions: listSessions(),
    };
  });

  ipcMain.handle("session:create", async (event) => {
    assertIpcSender(event.sender.id);
    const parent = BrowserWindow.fromWebContents(event.sender);
    if (!parent) throw new Error("无法找到桌面窗口");
    const result = await dialog.showOpenDialog(parent, {
      properties: ["openDirectory"],
      title: "选择 Claude Code 工作目录",
      buttonLabel: "在此目录开始",
    });
    if (result.canceled || !result.filePaths[0]) return undefined;
    const selected = result.filePaths[0];
    const info = await stat(selected);
    if (!info.isDirectory()) throw new Error("所选路径不是文件夹");
    return await createSession(selected);
  });

  ipcMain.handle("session:create-in-workspace", async (event, sessionId: unknown) => {
    assertIpcSender(event.sender.id);
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("会话编号无效");
    const sourceSession = getSession(sessionId);
    if (!sourceSession) throw new Error("找不到这个项目");
    if (deletingWorkspaces.has(sourceSession.cwd)) throw new Error("项目正在删除，请稍后重试");
    const workspace = await stat(sourceSession.cwd).catch(() => undefined);
    if (!workspace?.isDirectory()) throw new Error("项目文件夹已不存在，请重新选择目录");
    if (!getSession(sessionId)) throw new Error("项目已从列表移除，请重新选择目录");
    return await createSession(sourceSession.cwd);
  });

  ipcMain.handle("session:rename", async (event, input: unknown) => {
    assertIpcSender(event.sender.id);
    if (!input || typeof input !== "object") throw new Error("会话名称格式不正确");
    const values = input as Record<string, unknown>;
    if (typeof values.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(values.sessionId)) {
      throw new Error("会话编号无效");
    }
    if (typeof values.title !== "string") throw new Error("会话名称格式不正确");
    return await renameSession(values.sessionId, values.title);
  });

  ipcMain.handle("session:delete", async (event, sessionId: unknown) => {
    assertIpcSender(event.sender.id);
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new Error("会话编号无效");
    }
    if (activeTurns.has(sessionId) || startingTurns.has(sessionId)) throw new Error("会话正在运行，请停止任务后再删除");
    await deleteSession(sessionId);
  });

  ipcMain.handle("project:delete", async (event, sessionId: unknown) => {
    assertIpcSender(event.sender.id);
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new Error("项目编号无效");
    }
    const project = getSession(sessionId);
    if (!project) throw new Error("找不到这个项目");
    const cwd = project.cwd;
    if (deletingWorkspaces.has(cwd)) throw new Error("项目正在删除，请稍后重试");
    if ([...activeTurns.keys(), ...startingTurns].some((activeSessionId) => getSession(activeSessionId)?.cwd === cwd)) {
      throw new Error("项目中有会话正在运行，请停止任务后再删除项目");
    }
    deletingWorkspaces.add(cwd);
    try {
      await deleteProjectSessions(sessionId);
    } finally {
      deletingWorkspaces.delete(cwd);
    }
  });

  ipcMain.handle("session:history", (event, sessionId: unknown) => {
    assertIpcSender(event.sender.id);
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("会话编号无效");
    return getHistory(sessionId);
  });

  ipcMain.handle("settings:save", async (event, input: unknown) => {
    assertIpcSender(event.sender.id);
    if (!input || typeof input !== "object") throw new Error("设置格式不正确");
    const values = input as Record<string, unknown>;
    const settings = validateSettings(values.settings);
    const apiKey = values.apiKey;
    if (apiKey !== undefined && typeof apiKey !== "string") throw new Error("API Key 格式不正确");
    if (typeof apiKey === "string" && apiKey.trim()) {
      if (apiKey.trim().length > 512) throw new Error("API Key 太长");
      await writeApiKey(apiKey.trim());
    }
    if (values.clearApiKey === true) await clearApiKey();
    await writeSettings(settings);
    applyPermissionMode(settings.permissionMode);
    return { settings, hasApiKey: Boolean(await readApiKey()) };
  });

  ipcMain.handle("session:send", async (event, input: unknown) => {
    assertIpcSender(event.sender.id);
    if (!input || typeof input !== "object") throw new Error("消息格式不正确");
    const values = input as Record<string, unknown>;
    const sessionId = values.sessionId;
    const text = values.text;
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("会话编号无效");
    if (typeof text !== "string" || !text.trim() || text.length > MAX_PROMPT_LENGTH) throw new Error("请输入不超过 30000 字符的消息");
    if (activeTurns.has(sessionId) || startingTurns.has(sessionId)) throw new Error("这个会话还在运行中");
    const session = getSession(sessionId);
    if (!session) throw new Error("找不到这个会话");
    if (deletingWorkspaces.has(session.cwd)) throw new Error("项目正在删除，请稍后重试");
    if (activeTurns.size + startingTurns.size >= MAX_CONCURRENT_TURNS) throw new Error("同时运行的会话已达到上限，请等当前任务完成");
    startingTurns.add(sessionId);
    try {
      if (deletingWorkspaces.has(session.cwd)) throw new Error("项目正在删除，请稍后重试");
      const workspace = await stat(session.cwd).catch(() => undefined);
      if (!workspace?.isDirectory()) throw new Error("项目文件夹已不存在，请新建会话并重新选择目录");
      const apiKey = await readApiKey();
      if (!apiKey) {
        throw new Error("请先在设置中保存 DeepSeek API Key");
      }
      const settings = await readSettings();
      const cli = await inspectClaudeCli();
      if (!cli) throw new Error("没有找到 Claude Code CLI。请先安装 Claude Code。");
      if (!getSession(sessionId) || deletingWorkspaces.has(session.cwd)) {
        throw new Error("会话或项目已从列表移除，请重新选择项目");
      }

      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      await addMessage(sessionId, {
        id: userMessageId,
        role: "user",
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      await addMessage(sessionId, {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        createdAt: new Date().toISOString(),
      });
      const startedAt = Date.now();
      emit(event.sender.id, {
        type: "turn-start",
        sessionId,
        userMessageId,
        assistantMessageId,
        startedAt,
        text: text.trim(),
      });

      const active: ActiveTurn = {
        sessionId,
        messageId: assistantMessageId,
        startedAt,
        senderId: event.sender.id,
        permissionMode: settings.permissionMode,
        abortController: new AbortController(),
        stopRequested: false,
        toolActionCounts: new Map(),
        autoCompactionCount: 0,
        task: Promise.resolve(),
      };
      activeTurns.set(sessionId, active);
      startingTurns.delete(sessionId);
      active.task = runTurn(active, text.trim(), settings, apiKey, cli.path);
      void active.task.finally(() => activeTurns.delete(sessionId));
    } finally {
      startingTurns.delete(sessionId);
    }
  });

  ipcMain.handle("session:stop", async (event, sessionId: unknown) => {
    assertIpcSender(event.sender.id);
    if (typeof sessionId !== "string") return;
    const active = activeTurns.get(sessionId);
    if (!active || active.senderId !== event.sender.id) return;
    active.stopRequested = true;
    emitDiagnostic(event.sender.id, sessionId, "warn", "用户停止了当前 CLI 请求");
    closeActiveQuery(active);
  });

  ipcMain.handle("permission:resolve", (event, input: unknown) => {
    assertIpcSender(event.sender.id);
    if (!input || typeof input !== "object") return;
    const values = input as Record<string, unknown>;
    if (typeof values.requestId !== "string" || typeof values.allow !== "boolean") return;
    const pending = pendingPermissions.get(values.requestId);
    if (!pending || pending.senderId !== event.sender.id) return;
    pending.resolve(values.allow
      ? { behavior: "allow", toolUseID: pending.toolUseId }
      : { behavior: "deny", message: "用户拒绝了这项操作", toolUseID: pending.toolUseId });
  });
}

async function runTurn(
  active: ActiveTurn,
  prompt: string,
  settings: AppSettings,
  apiKey: string | undefined,
  cliPath: string,
): Promise<void> {
  const currentSession = getSession(active.sessionId);
  if (!currentSession) return;
  const modelIdleTimeoutMs = desktopPlatform.modelIdleTimeoutMs;
  const idleTimeoutMessage = desktopPlatform.idleTimeoutMessage;
  const log = (
    level: "info" | "warn" | "error",
    message: string,
  ): void => emitDiagnostic(
    active.senderId,
    active.sessionId,
    level,
    message,
    apiKey,
  );
  let stderrBuffer = "";
  const flushStderr = (): void => {
    const line = stderrBuffer.trim();
    stderrBuffer = "";
    if (line) log("warn", "CLI stderr: " + line);
  };
  const captureStderr = (data: string): void => {
    const lines = (stderrBuffer + data.replace(/\0/g, "")).split(/\r?\n/);
    stderrBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) log("warn", "CLI stderr: " + line);
    }
    if (stderrBuffer.length > 1200) flushStderr();
  };
  let reportedDurationMs: number | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimedOut = false;
  const resetIdleTimer = (timeoutMs: number): void => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      closeActiveQuery(active);
    }, timeoutMs);
  };
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: desktopPlatform.buildSystemPath(
      process.env,
      app.getPath("home"),
      cliPath,
    ),
    ANTHROPIC_BASE_URL: settings.baseUrl,
    ANTHROPIC_AUTH_TOKEN: apiKey ?? "",
    ANTHROPIC_API_KEY: "",
    CLAUDE_CODE_OAUTH_TOKEN: "",
    ANTHROPIC_MODEL: settings.model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: settings.model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: settings.model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: settings.model,
    CLAUDE_CODE_SUBAGENT_MODEL: settings.model,
    CLAUDE_CODE_AGENT_SDK_CLIENT_APP: "claude-cli-studio",
  };
  try {
    log("info", "启动 Claude Code CLI: " + cliPath);
    log("info", "工作区: " + currentSession.cwd);
    log(
      "info",
      "Studio 请求配置: model=" + settings.model +
        "; endpoint=" + describeEndpoint(settings.baseUrl) +
        "; permissionMode=" + active.permissionMode +
        "; maxTurns=" + MAX_AGENTIC_TURNS,
    );
    const previousMessages = getHistory(active.sessionId);
    const isFirstTurn = previousMessages.filter((message) => message.role === "user").length <= 1;
    const currentQuery = query({
      prompt,
      options: {
        cwd: currentSession.cwd,
        pathToClaudeCodeExecutable: cliPath,
        abortController: active.abortController,
        ...(isFirstTurn ? { sessionId: active.sessionId } : { resume: active.sessionId }),
        model: settings.model,
        permissionMode: "default",
        canUseTool: makePermissionHandler(active),
        includePartialMessages: true,
        maxTurns: MAX_AGENTIC_TURNS,
        env: environment,
        stderr: captureStderr,
      },
    });
    active.query = currentQuery;

    let streamedText = "";
    let finalResult = "";
    let finalError: string | undefined;
    let finalStopReason: string | null | undefined;
    let awaitingToolResult = false;
    resetIdleTimer(modelIdleTimeoutMs);
    for await (const message of currentQuery) {
      const isToolExecution = message.type === "assistant" &&
        message.message.content.some((block) => block.type === "tool_use");
      if (message.type === "assistant") awaitingToolResult = isToolExecution;
      else if (message.type === "user" && awaitingToolResult) {
        awaitingToolResult = false;
        log("info", "工具执行已返回，CLI 正在继续处理");
      }
      if (isToolExecution || awaitingToolResult) resetIdleTimer(TOOL_IDLE_TIMEOUT_MS);
      else resetIdleTimer(modelIdleTimeoutMs);
      if (message.type === "system" && message.subtype === "init") {
        log(
          "info",
          "CLI 初始化完成: version=" + message.claude_code_version +
            "; model=" + message.model +
            "; cliAuthSource=" + message.apiKeySource +
            "; studioApiKeyProvided=" + Boolean(apiKey),
        );
      } else if (message.type === "system" && message.subtype === "api_retry") {
        log(
          "warn",
          "API 重试 " + message.attempt + "/" + message.max_retries +
            "; status=" + (message.error_status ?? "network") +
            "; delay=" + message.retry_delay_ms + "ms" +
            "; error=" + message.error,
        );
      } else if (
        message.type === "system" &&
        message.subtype === "status"
      ) {
        if (message.status) log("info", "CLI 状态: " + message.status);
        if (message.status === "compacting") {
          log("info", "Claude 正在压缩上下文");
          emit(active.senderId, {
            type: "context-compaction",
            sessionId: active.sessionId,
            messageId: active.messageId,
            phase: "starting",
            autoCompactionCount: active.autoCompactionCount,
          });
        }
        if (message.compact_result === "failed") {
          log("warn", "Claude 上下文压缩未完成" + (message.compact_error ? ": " + message.compact_error : ""));
          emit(active.senderId, {
            type: "context-compaction",
            sessionId: active.sessionId,
            messageId: active.messageId,
            phase: "failed",
            autoCompactionCount: active.autoCompactionCount,
          });
        }
      }
      if (message.type === "system" && message.subtype === "compact_boundary") {
        const metadata = message.compact_metadata;
        if (metadata.trigger === "auto") {
          active.autoCompactionCount = Math.min(10_000, active.autoCompactionCount + 1);
          active.lastAutoCompaction = {
            preTokens: metadata.pre_tokens,
            ...(typeof metadata.post_tokens === "number" ? { postTokens: metadata.post_tokens } : {}),
          };
          setAssistantAutoCompaction(
            active.sessionId,
            active.messageId,
            active.autoCompactionCount,
            active.lastAutoCompaction,
          );
          log(
            "info",
            `Claude 自动压缩完成: count=${active.autoCompactionCount}; preTokens=${metadata.pre_tokens}; postTokens=${metadata.post_tokens ?? "unknown"}`,
          );
          emit(active.senderId, {
            type: "context-compaction",
            sessionId: active.sessionId,
            messageId: active.messageId,
            phase: "completed",
            trigger: "auto",
            autoCompactionCount: active.autoCompactionCount,
            preTokens: metadata.pre_tokens,
            ...(typeof metadata.post_tokens === "number" ? { postTokens: metadata.post_tokens } : {}),
          });
          await persistSessions().catch((error) => {
            log("warn", "无法保存自动压缩记录: " + sanitizeError(error, apiKey));
          });
        } else {
          emit(active.senderId, {
            type: "context-compaction",
            sessionId: active.sessionId,
            messageId: active.messageId,
            phase: "completed",
            trigger: "manual",
            autoCompactionCount: active.autoCompactionCount,
          });
        }
      }
      if (message.type === "stream_event") {
        const event = message.event;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          typeof event.delta.text === "string"
        ) {
          streamedText += event.delta.text;
          appendAssistantText(active.sessionId, active.messageId, event.delta.text);
          emit(active.senderId, {
            type: "text-delta",
            sessionId: active.sessionId,
            messageId: active.messageId,
            text: event.delta.text,
          });
        }
      } else if (message.type === "assistant") {
        if (message.error) log("error", "CLI assistant error: " + message.error);
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            const activity = recordToolAction(active, block.name);
            log("info", `Claude 正在${activity.action} · 已发起 ${activity.total} 项操作`);
            emit(active.senderId, {
              type: "tool-call",
              sessionId: active.sessionId,
              messageId: active.messageId,
              action: activity.action,
              total: activity.total,
              activitySummary: activity.summary,
            });
          } else if (block.type === "text") {
            if (/API Error|Model is unavailable|HTTP\s+[45]\d{2}/i.test(block.text)) {
              log("error", "CLI 模型/API 错误: " + block.text);
            }
            if (!streamedText) {
              streamedText = block.text;
              appendAssistantText(active.sessionId, active.messageId, block.text);
              emit(active.senderId, {
                type: "text-delta",
                sessionId: active.sessionId,
                messageId: active.messageId,
                text: block.text,
              });
            }
          }
        }
      } else if (message.type === "result") {
        reportedDurationMs = message.duration_ms;
        finalStopReason = message.stop_reason;
        if (message.subtype === "success") {
          finalResult = message.result;
          log(
            "info",
            "CLI 请求完成: turns=" + message.num_turns +
              "; duration=" + message.duration_ms + "ms" +
              "; stopReason=" + (message.stop_reason ?? "none") +
              "; resultChars=" + message.result.length +
              "; streamedTextChars=" + streamedText.length,
          );
        } else {
          finalError = message.errors.join("\n") || "Claude CLI 执行失败";
          log(
            "error",
            "CLI 返回错误 (" + message.subtype + "): turns=" + message.num_turns +
              "; duration=" + message.duration_ms + "ms" +
              "; stopReason=" + (message.stop_reason ?? "none") +
              "; " + finalError,
          );
        }
      }
    }
    flushStderr();
    if (!finalError && !active.stopRequested && !idleTimedOut && !finalResult && !streamedText) {
      finalResult = "Claude Code CLI 已完成工具操作，但没有返回文字回复。请查看运行日志中的 resultChars 和 stopReason。";
      appendAssistantText(active.sessionId, active.messageId, finalResult);
      log(
        "warn",
        "CLI 成功结束但没有最终文本: resultChars=0; streamedTextChars=0; stopReason=" +
          (finalStopReason ?? "none"),
      );
    }
    const durationMs = reportedDurationMs ?? Math.max(0, Date.now() - active.startedAt);
    setAssistantDuration(active.sessionId, active.messageId, durationMs);
    const activity = persistToolActivity(active);
    await persistSessions();
    if (active.stopRequested) {
      emit(active.senderId, {
        type: "turn-stopped",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        ...activityEventFields(activity),
      });
      return;
    }
    if (idleTimedOut) {
      log("error", idleTimeoutMessage);
      emit(active.senderId, {
        type: "turn-error",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        message: idleTimeoutMessage,
        ...activityEventFields(activity),
      });
      return;
    }
    if (finalError) {
      const maxTurnsMatch = finalError.match(/maximum number of turns \((\d+)\)/i);
      const userMessage = maxTurnsMatch
        ? `本次请求达到 ${maxTurnsMatch[1]} 轮工具处理上限，模型尚未生成最终回复。请拆分任务后重试。`
        : sanitizeError(finalError, apiKey);
      emit(active.senderId, {
        type: "turn-error",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        message: userMessage,
        ...activityEventFields(activity),
      });
      return;
    }
    log("info", "本轮运行结束");
    emit(active.senderId, {
      type: "turn-complete",
      sessionId: active.sessionId,
      messageId: active.messageId,
      durationMs,
      result: finalResult || streamedText,
      ...activityEventFields(activity),
    });
  } catch (error) {
    const durationMs = reportedDurationMs ?? Math.max(0, Date.now() - active.startedAt);
    setAssistantDuration(active.sessionId, active.messageId, durationMs);
    const activity = persistToolActivity(active);
    await persistSessions().catch(() => undefined);
    if (active.stopRequested) {
      emit(active.senderId, {
        type: "turn-stopped",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        ...activityEventFields(activity),
      });
    } else if (idleTimedOut) {
      log("error", idleTimeoutMessage);
      emit(active.senderId, {
        type: "turn-error",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        message: idleTimeoutMessage,
        ...activityEventFields(activity),
      });
    } else {
      const message = sanitizeError(error, apiKey);
      log("error", "运行异常: " + message);
      emit(active.senderId, {
        type: "turn-error",
        sessionId: active.sessionId,
        messageId: active.messageId,
        durationMs,
        message,
        ...activityEventFields(activity),
      });
    }
  } finally {
    flushStderr();
    if (idleTimer) clearTimeout(idleTimer);
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const permission of pendingPermissions.values()) permission.abort();
  const turns = [...activeTurns.values()];
  await Promise.all(turns.map(async (turn) => {
    turn.stopRequested = true;
    closeActiveQuery(turn);
    await turn.task.catch(() => undefined);
  }));
  await persistSessions().catch(() => undefined);
}

registerHandlers();

app.whenReady().then(async () => {
  await initializeStore(app.getPath("userData"));
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch(() => {
  app.quit();
});

app.on("before-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  void shutdown().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (desktopPlatform.quitWhenWindowsClosed) app.quit();
});
