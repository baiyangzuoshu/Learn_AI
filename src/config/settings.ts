import type { ProviderConfig } from "../providers/contracts.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { appDataDir } from "./paths.ts";

const SERVICE = "com.youjunmao.deno-agent";
const LEGACY_ACCOUNT = "deepseek-api-key";
const DEFAULT_PROVIDER_ID = "deepseek";
const DEFAULT_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];
const DEFAULT_UPDATE_URL = "https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest";
const workspaceContext = new AsyncLocalStorage<string>();

export interface PublicProviderSettings {
  id: string;
  name: string;
  protocol: "openai";
  baseUrl: string;
  models: string[];
  defaultModel: string;
  hasApiKey: boolean;
  builtIn?: boolean;
}

export interface PublicModelOption {
  providerId: string;
  providerName: string;
  model: string;
  value: string;
  label: string;
}

export interface PublicSettings {
  baseUrl: string;
  models: string[];
  defaultModel: string;
  hasApiKey: boolean;
  defaultProviderId: string;
  providers: PublicProviderSettings[];
  modelOptions: PublicModelOption[];
  workspace?: string;
  workspaces: string[];
  settingsPath: string;
  update: UpdateSettings;
}

interface StoredProviderSettings {
  id: string;
  name: string;
  protocol: "openai";
  baseUrl: string;
  models: string[];
  defaultModel: string;
  builtIn?: boolean;
  apiKeyEnv?: string;
}

interface StoredSettings {
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  defaultProviderId?: string;
  providers?: StoredProviderSettings[];
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

type SaveProviderInput = Partial<StoredProviderSettings> & {
  apiKey?: string;
};

function settingsPath(): string {
  return `${appDataDir()}/settings.json`;
}

export function settingsFilePath(): string {
  return settingsPath();
}

function env(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

function defaultUpdateSettings(): UpdateSettings {
  return {
    checkOnStartup: true,
    updateUrl: env("DENO_AGENT_UPDATE_URL")?.trim() || DEFAULT_UPDATE_URL,
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

function normalizeModels(input?: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeBaseUrl(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Base URL 不能为空");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Base URL 格式无效");
  }
  const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ||
    parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    throw new Error("Base URL 必须使用 HTTPS；本地开发只允许 localhost HTTP");
  }
  let normalized = raw.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    normalized = normalized.slice(0, -"/chat/completions".length).replace(/\/+$/, "");
  }
  return normalized;
}

function sanitizeProviderId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) ||
    "provider";
}

function uniqueProviderId(base: string, used: Set<string>): string {
  const root = sanitizeProviderId(base);
  let candidate = root;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${root}-${index}`;
    index++;
  }
  used.add(candidate);
  return candidate;
}

function defaultDeepSeekProvider(): StoredProviderSettings {
  return {
    id: DEFAULT_PROVIDER_ID,
    name: "DeepSeek 官方",
    protocol: "openai",
    baseUrl: env("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
    models: DEFAULT_MODELS,
    defaultModel: env("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
    builtIn: true,
    apiKeyEnv: "DEEPSEEK_API_KEY",
  };
}

function legacyModels(parsed: Partial<StoredSettings>, fallback: StoredProviderSettings): string[] {
  const savedModels = normalizeModels(parsed.models);
  const legacyDefaults = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"];
  if (!savedModels.length) return fallback.models;
  return savedModels.join("\n") === legacyDefaults.join("\n") ? DEFAULT_MODELS : savedModels;
}

function normalizeStoredProvider(
  raw: Partial<StoredProviderSettings>,
  used: Set<string>,
): StoredProviderSettings {
  const name = String(raw.name ?? raw.id ?? "自定义供应商").trim() || "自定义供应商";
  const id = raw.id ? uniqueProviderId(String(raw.id), used) : uniqueProviderId(name, used);
  const models = normalizeModels(raw.models);
  if (!models.length) throw new Error(`${name} 至少配置一个模型`);
  const defaultModel = raw.defaultModel && models.includes(raw.defaultModel)
    ? raw.defaultModel
    : models[0];
  return {
    id,
    name,
    protocol: "openai",
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    models,
    defaultModel,
    builtIn: raw.builtIn === true || id === DEFAULT_PROVIDER_ID,
    apiKeyEnv: raw.apiKeyEnv?.trim() ||
      (id === DEFAULT_PROVIDER_ID ? "DEEPSEEK_API_KEY" : undefined),
  };
}

function providersFromStored(parsed: Partial<StoredSettings>): StoredProviderSettings[] {
  const used = new Set<string>();
  const fromProviders = Array.isArray(parsed.providers)
    ? parsed.providers.flatMap((provider) => {
      try {
        return [normalizeStoredProvider(provider, used)];
      } catch {
        return [];
      }
    })
    : [];
  if (fromProviders.length) return fromProviders;
  const fallback = defaultDeepSeekProvider();
  const models = legacyModels(parsed, fallback);
  const defaultModel = parsed.defaultModel && models.includes(parsed.defaultModel)
    ? parsed.defaultModel
    : models[0];
  return [
    normalizeStoredProvider({
      ...fallback,
      baseUrl: parsed.baseUrl?.trim() || fallback.baseUrl,
      models,
      defaultModel,
    }, used),
  ];
}

async function readStored(): Promise<StoredSettings> {
  const fallbackProvider = defaultDeepSeekProvider();
  const fallback: StoredSettings = {
    providers: [fallbackProvider],
    defaultProviderId: fallbackProvider.id,
    workspace: undefined,
    workspaces: [],
    update: defaultUpdateSettings(),
  };
  try {
    const parsed = JSON.parse(await Deno.readTextFile(settingsPath())) as Partial<StoredSettings>;
    const providers = providersFromStored(parsed);
    const workspaces = parsed.workspaces ?? (parsed.workspace ? [parsed.workspace] : []);
    const workspace = parsed.workspace && workspaces.includes(parsed.workspace)
      ? parsed.workspace
      : workspaces[0];
    const defaultProviderId = providers.some((item) => item.id === parsed.defaultProviderId)
      ? parsed.defaultProviderId
      : providers[0].id;
    return {
      providers,
      defaultProviderId,
      workspace,
      workspaces,
      update: normalizeUpdateSettings(parsed.update),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return fallback;
    throw error;
  }
}

async function writeStored(settings: StoredSettings): Promise<void> {
  const target = settingsPath();
  await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  await Deno.rename(temporary, target);
}

async function keychain(args: string[]): Promise<{ ok: boolean; output: string }> {
  const result = await new Deno.Command("/usr/bin/security", {
    args,
    stdout: "piped",
    stderr: "null",
  }).output();
  return { ok: result.success, output: new TextDecoder().decode(result.stdout).trim() };
}

function keychainAccount(providerId: string): string {
  return providerId === DEFAULT_PROVIDER_ID ? LEGACY_ACCOUNT : `provider:${providerId}:api-key`;
}

function providerEnvName(provider: StoredProviderSettings): string | undefined {
  return provider.apiKeyEnv || `${provider.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}

async function readProviderKey(provider: StoredProviderSettings): Promise<string | undefined> {
  const envName = providerEnvName(provider);
  const envKey = envName ? env(envName) : undefined;
  if (envKey) return envKey;
  const result = await keychain([
    "find-generic-password",
    "-s",
    SERVICE,
    "-a",
    keychainAccount(provider.id),
    "-w",
  ]);
  return result.ok && result.output ? result.output : undefined;
}

async function saveProviderKey(providerId: string, apiKey: string): Promise<void> {
  const result = await keychain([
    "add-generic-password",
    "-U",
    "-s",
    SERVICE,
    "-a",
    keychainAccount(providerId),
    "-w",
    apiKey.trim(),
  ]);
  if (!result.ok) throw new Error("无法写入 macOS Keychain");
}

function modelValue(providerId: string, model: string): string {
  return `${encodeURIComponent(providerId)}:${encodeURIComponent(model)}`;
}

function modelOptions(providers: PublicProviderSettings[]): PublicModelOption[] {
  return providers.flatMap((provider) =>
    provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      model,
      value: modelValue(provider.id, model),
      label: `${provider.name} · ${model}`,
    }))
  );
}

export async function revealApiKey(): Promise<string> {
  const stored = await readStored();
  const provider = stored.providers?.find((item) => item.id === stored.defaultProviderId) ??
    stored.providers?.[0];
  return provider ? await readProviderKey(provider) ?? "" : "";
}

export async function revealApiKeys(): Promise<Record<string, string>> {
  const stored = await readStored();
  const entries = await Promise.all((stored.providers ?? []).map(async (provider) => {
    return [provider.id, await readProviderKey(provider) ?? ""] as const;
  }));
  return Object.fromEntries(entries);
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const stored = await readStored();
  const providers = await Promise.all((stored.providers ?? []).map(async (provider) => ({
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    models: provider.models,
    defaultModel: provider.defaultModel,
    builtIn: provider.builtIn,
    hasApiKey: Boolean(await readProviderKey(provider)),
  })));
  const defaultProvider = providers.find((item) => item.id === stored.defaultProviderId) ??
    providers[0];
  return {
    baseUrl: defaultProvider.baseUrl,
    models: defaultProvider.models,
    defaultModel: defaultProvider.defaultModel,
    hasApiKey: defaultProvider.hasApiKey,
    defaultProviderId: defaultProvider.id,
    providers,
    modelOptions: modelOptions(providers),
    workspace: stored.workspace,
    workspaces: stored.workspaces ?? [],
    update: normalizeUpdateSettings(stored.update),
    settingsPath: settingsPath(),
  };
}

function normalizeProviderInput(
  input: SaveProviderInput,
  used: Set<string>,
  existing?: StoredProviderSettings,
): StoredProviderSettings {
  const candidate = {
    ...existing,
    ...input,
    id: input.id || existing?.id,
    name: input.name || existing?.name,
    protocol: "openai" as const,
    builtIn: existing?.builtIn || input.builtIn,
    apiKeyEnv: existing?.apiKeyEnv || input.apiKeyEnv,
  };
  return normalizeStoredProvider(candidate, used);
}

export async function saveSettings(
  input: {
    apiKey?: string;
    baseUrl?: string;
    models?: string[];
    defaultModel?: string;
    defaultProviderId?: string;
    providers?: SaveProviderInput[];
  },
): Promise<PublicSettings> {
  const current = await readStored();
  const providerInputs = Array.isArray(input.providers) && input.providers.length
    ? input.providers
    : [{
      id: DEFAULT_PROVIDER_ID,
      name: "DeepSeek 官方",
      baseUrl: input.baseUrl,
      models: input.models,
      defaultModel: input.defaultModel,
      apiKey: input.apiKey,
      builtIn: true,
      apiKeyEnv: "DEEPSEEK_API_KEY",
    }];
  const used = new Set<string>();
  const providers = providerInputs.map((providerInput) => {
    const existing = current.providers?.find((item) => item.id === providerInput.id);
    return normalizeProviderInput(providerInput, used, existing);
  });
  if (!providers.length) throw new Error("至少配置一个模型供应商");

  for (let index = 0; index < providers.length; index++) {
    const apiKey = providerInputs[index]?.apiKey?.trim();
    if (apiKey) await saveProviderKey(providers[index].id, apiKey);
  }

  const defaultProviderId = providers.some((item) => item.id === input.defaultProviderId)
    ? input.defaultProviderId
    : providers[0].id;
  await writeStored({
    providers,
    defaultProviderId,
    workspace: current.workspace,
    workspaces: current.workspaces ?? [],
    update: normalizeUpdateSettings(current.update),
  });
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
  await writeStored({ ...current, update });
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
  await writeStored({ ...current, workspace, workspaces });
  return await getPublicSettings();
}

export async function selectWorkspace(workspace: string): Promise<PublicSettings> {
  const current = await readStored();
  if (!(current.workspaces ?? []).includes(workspace)) throw new Error("目录不存在");
  await writeStored({ ...current, workspace });
  return await getPublicSettings();
}

export async function removeWorkspace(workspace: string): Promise<PublicSettings> {
  const current = await readStored();
  const workspaces = (current.workspaces ?? []).filter((item) => item !== workspace);
  const active = current.workspace === workspace ? workspaces[0] : current.workspace;
  await writeStored({ ...current, workspace: active, workspaces });
  return await getPublicSettings();
}

export async function resolveProviderConfig(
  providerId?: string,
  model?: string,
): Promise<ProviderConfig> {
  const stored = await readStored();
  const provider =
    (providerId
      ? stored.providers?.find((item) => item.id === providerId)
      : stored.providers?.find((item) => item.id === stored.defaultProviderId)) ??
      stored.providers?.[0];
  if (!provider) throw new Error("请先在设置中配置模型供应商");
  const apiKey = await readProviderKey(provider);
  if (!apiKey) throw new Error(`请先在设置中配置 ${provider.name} API Key`);
  const selected = model || provider.defaultModel;
  if (!provider.models.includes(selected)) {
    throw new Error(`所选模型未配置：${provider.name} / ${selected}`);
  }
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    apiKey,
    baseUrl: provider.baseUrl.replace(/\/$/, ""),
    model: selected,
  };
}

export async function resolveDeepSeekConfig(model?: string): Promise<ProviderConfig> {
  return await resolveProviderConfig(undefined, model);
}
