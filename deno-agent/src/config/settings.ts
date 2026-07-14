import type { DeepSeekConfig } from "../providers/deepseek.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { appDataDir } from "./paths.ts";

const SERVICE = "com.youjunmao.deno-agent";
const ACCOUNT = "deepseek-api-key";
const DEFAULT_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];
const DEFAULT_UPDATE_URL = "https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest";
const workspaceContext = new AsyncLocalStorage<string>();

export interface PublicSettings {
  baseUrl: string;
  models: string[];
  defaultModel: string;
  hasApiKey: boolean;
  workspace?: string;
  workspaces: string[];
  settingsPath: string;
  update: UpdateSettings;
}
interface StoredSettings {
  baseUrl: string;
  models: string[];
  defaultModel: string;
  workspace?: string;
  workspaces?: string[];
  update?: Partial<UpdateSettings>;
}
export interface UpdateSettings {
  checkOnStartup: boolean;
  updateUrl: string;
  lastCheckAt?: string;
  latestVersion?: string;
  releaseUrl?: string;
}

function settingsPath(): string {
  return `${appDataDir()}/settings.json`;
}

export function settingsFilePath(): string {
  return settingsPath();
}

function defaultUpdateSettings(): UpdateSettings {
  return {
    checkOnStartup: true,
    updateUrl: Deno.env.get("DENO_AGENT_UPDATE_URL")?.trim() || DEFAULT_UPDATE_URL,
  };
}

function normalizeUpdateSettings(input?: Partial<UpdateSettings>): UpdateSettings {
  const fallback = defaultUpdateSettings();
  return {
    checkOnStartup: input?.checkOnStartup ?? fallback.checkOnStartup,
    updateUrl: input?.updateUrl?.trim() || fallback.updateUrl,
    lastCheckAt: input?.lastCheckAt,
    latestVersion: input?.latestVersion,
    releaseUrl: input?.releaseUrl,
  };
}

async function readStored(): Promise<StoredSettings> {
  const fallback: StoredSettings = {
    baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
    models: DEFAULT_MODELS,
    defaultModel: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
    update: defaultUpdateSettings(),
  };
  try {
    const parsed = JSON.parse(await Deno.readTextFile(settingsPath())) as Partial<StoredSettings>;
    const savedModels = parsed.models?.filter(Boolean);
    const legacyDefaults = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"];
    const models = savedModels?.join("\n") === legacyDefaults.join("\n")
      ? DEFAULT_MODELS
      : savedModels ?? fallback.models;
    const workspaces = parsed.workspaces ?? (parsed.workspace ? [parsed.workspace] : []);
    const workspace = parsed.workspace && workspaces.includes(parsed.workspace)
      ? parsed.workspace
      : workspaces[0];
    return {
      baseUrl: parsed.baseUrl?.trim() || fallback.baseUrl,
      models,
      defaultModel: parsed.defaultModel && models.includes(parsed.defaultModel)
        ? parsed.defaultModel
        : models[0],
      workspace,
      workspaces,
      update: normalizeUpdateSettings(parsed.update),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return fallback;
    throw error;
  }
}

async function keychain(args: string[]): Promise<{ ok: boolean; output: string }> {
  const result = await new Deno.Command("/usr/bin/security", {
    args,
    stdout: "piped",
    stderr: "null",
  }).output();
  return { ok: result.success, output: new TextDecoder().decode(result.stdout).trim() };
}

async function readKey(): Promise<string | undefined> {
  const envKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (envKey) return envKey;
  const result = await keychain(["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]);
  return result.ok && result.output ? result.output : undefined;
}

export async function revealApiKey(): Promise<string> {
  return await readKey() ?? "";
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const stored = await readStored();
  return {
    ...stored,
    workspaces: stored.workspaces ?? [],
    update: normalizeUpdateSettings(stored.update),
    settingsPath: settingsPath(),
    hasApiKey: Boolean(await readKey()),
  };
}

export async function saveSettings(
  input: { apiKey?: string; baseUrl: string; models: string[]; defaultModel: string },
): Promise<PublicSettings> {
  const models = [...new Set(input.models.map((item) => item.trim()).filter(Boolean))];
  if (!input.baseUrl.startsWith("https://")) throw new Error("Base URL 必须使用 HTTPS");
  if (!models.length) throw new Error("至少配置一个模型");
  if (!models.includes(input.defaultModel)) throw new Error("默认模型不在模型列表中");
  if (input.apiKey?.trim()) {
    const result = await keychain([
      "add-generic-password",
      "-U",
      "-s",
      SERVICE,
      "-a",
      ACCOUNT,
      "-w",
      input.apiKey.trim(),
    ]);
    if (!result.ok) throw new Error("无法写入 macOS Keychain");
  }
  const path = settingsPath();
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const current = await readStored();
  await Deno.writeTextFile(
    path,
    JSON.stringify(
      {
        baseUrl: input.baseUrl.replace(/\/$/, ""),
        models,
        defaultModel: input.defaultModel,
        workspace: current.workspace,
        workspaces: current.workspaces ?? [],
        update: normalizeUpdateSettings(current.update),
      },
      null,
      2,
    ),
  );
  return await getPublicSettings();
}

export async function saveUpdateSettings(input: Partial<UpdateSettings>): Promise<PublicSettings> {
  const current = await readStored();
  const update = normalizeUpdateSettings({ ...current.update, ...input });
  if (
    update.updateUrl &&
    !update.updateUrl.startsWith("https://") &&
    !update.updateUrl.startsWith("http://127.0.0.1") &&
    !update.updateUrl.startsWith("http://localhost")
  ) {
    throw new Error("更新源必须使用 HTTPS；本地开发只允许 localhost HTTP");
  }
  const path = settingsPath();
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify({ ...current, update }, null, 2));
  return await getPublicSettings();
}

export async function getWorkspace(): Promise<string> {
  const scoped = workspaceContext.getStore();
  if (scoped) return scoped;
  const workspace = (await readStored()).workspace;
  if (!workspace) throw new Error("请先点击左侧“新目录”选择工作目录");
  const stat = await Deno.stat(workspace);
  if (!stat.isDirectory) throw new Error("保存的工作目录已失效");
  return workspace;
}
export async function withWorkspace<T>(workspace: string, action: () => Promise<T>): Promise<T> {
  const stat = await Deno.stat(workspace);
  if (!stat.isDirectory) throw new Error("绑定的项目目录已失效");
  return await workspaceContext.run(workspace, action);
}

export async function chooseWorkspace(): Promise<PublicSettings> {
  const script = 'POSIX path of (choose folder with prompt "选择 Deno Agent 工作目录")';
  const result = await new Deno.Command("/usr/bin/osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error("已取消选择目录");
  const workspace = new TextDecoder().decode(result.stdout).trim().replace(/\/$/, "");
  const current = await readStored();
  const workspaces = [...new Set([...(current.workspaces ?? []), workspace])];
  const path = settingsPath();
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify({ ...current, workspace, workspaces }, null, 2));
  return await getPublicSettings();
}

export async function selectWorkspace(workspace: string): Promise<PublicSettings> {
  const current = await readStored();
  if (!(current.workspaces ?? []).includes(workspace)) throw new Error("目录不存在");
  await Deno.writeTextFile(settingsPath(), JSON.stringify({ ...current, workspace }, null, 2));
  return await getPublicSettings();
}

export async function removeWorkspace(workspace: string): Promise<PublicSettings> {
  const current = await readStored();
  const workspaces = (current.workspaces ?? []).filter((item) => item !== workspace);
  const active = current.workspace === workspace ? workspaces[0] : current.workspace;
  await Deno.writeTextFile(
    settingsPath(),
    JSON.stringify({ ...current, workspace: active, workspaces }, null, 2),
  );
  return await getPublicSettings();
}

export async function resolveDeepSeekConfig(model?: string): Promise<DeepSeekConfig> {
  const stored = await readStored();
  const apiKey = await readKey();
  if (!apiKey) throw new Error("请先在设置中配置 DeepSeek API Key");
  const selected = model || stored.defaultModel;
  if (!stored.models.includes(selected)) throw new Error("所选模型未配置");
  return { apiKey, baseUrl: stored.baseUrl.replace(/\/$/, ""), model: selected };
}
