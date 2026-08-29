// main.ts
import { app, BrowserWindow, dialog, safeStorage } from "electron";
import { createHash } from "node:crypto";
import { dirname as dirname4, join as join4 } from "node:path";
import { fileURLToPath } from "node:url";

// ../src/platform.ts
import { spawn } from "node:child_process";
import { Buffer as Buffer2 } from "node:buffer";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
var secretStore;
var permissionPrompt;
var folderChooser;
var configuredAppDataPath;
var isWindows = process.platform === "win32";
var isMacOS = process.platform === "darwin";
function environment(name) {
  return process.env[name];
}
function platformVersion() {
  return `Node.js ${process.version}`;
}
function appDataPath() {
  if (configuredAppDataPath) return configuredAppDataPath;
  const root = isWindows ? process.env.APPDATA : isMacOS ? process.env.HOME && `${process.env.HOME}/Library/Application Support` : process.env.XDG_DATA_HOME ?? (process.env.HOME && `${process.env.HOME}/.local/share`);
  if (!root) throw new Error("User application data directory is unavailable");
  return `${root}/AIAgent`;
}
function setAppDataPath(path2) {
  configuredAppDataPath = path2;
}
function isNotFound(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
function setSecretStore(store) {
  secretStore = store;
}
async function readSecret(service, account) {
  return await secretStore?.get(service, account);
}
async function writeSecret(service, account, value2) {
  if (!secretStore) throw new Error("\u5B89\u5168\u51ED\u636E\u5B58\u50A8\u5C1A\u672A\u521D\u59CB\u5316");
  await secretStore.set(service, account, value2);
}
function setPermissionPrompt(prompt) {
  permissionPrompt = prompt;
}
function setFolderChooser(chooser) {
  folderChooser = chooser;
}
async function chooseFolder() {
  return await folderChooser?.();
}
function confirmPermission(message) {
  return permissionPrompt?.(message) ?? false;
}
async function writeJsonAtomic(path2, value2) {
  await writeTextAtomic(path2, `${JSON.stringify(value2, null, 2)}
`);
}
async function writeTextAtomic(path2, content) {
  await writeBufferAtomic(path2, Buffer2.from(content, "utf8"));
}
async function writeBufferAtomic(path2, content) {
  await mkdir(dirname(path2), { recursive: true });
  const temporary = `${path2}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path2);
}
async function readUtf8(path2) {
  return await readFile(path2, "utf8");
}
async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  child.stdout?.on("data", (chunk) => stdout.push(chunk));
  child.stderr?.on("data", (chunk) => stderr.push(chunk));
  return await new Promise((resolve4, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve4({
      success: code === 0,
      code,
      stdout: Buffer2.concat(stdout).toString("utf8"),
      stderr: Buffer2.concat(stderr).toString("utf8")
    }));
  });
}
function spawnCommand(command, args, options = {}) {
  return spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
}

// ../src/providers/openai_compatible.ts
var telemetry = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  lastTotalTokens: 0,
  lastCacheHitTokens: 0,
  lastProviderId: "",
  lastProviderName: "",
  lastModel: "",
  lastCost: null,
  totalCost: 0,
  costCurrency: "CNY",
  costEstimated: false
};
function providerTelemetry() {
  return { ...telemetry };
}
var DEEPSEEK_PRICING = {
  "deepseek-v4-flash": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.02,
    inputCacheMissPerMillion: 1,
    outputPerMillion: 2
  },
  "deepseek-v4-pro": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.025,
    inputCacheMissPerMillion: 3,
    outputPerMillion: 6
  },
  "deepseek-chat": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.02,
    inputCacheMissPerMillion: 1,
    outputPerMillion: 2
  },
  "deepseek-reasoner": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.025,
    inputCacheMissPerMillion: 3,
    outputPerMillion: 6
  }
};
function providerPricing(config) {
  const identity = `${config.id} ${config.name} ${config.baseUrl}`.toLowerCase();
  if (!identity.includes("deepseek")) return void 0;
  const model = config.model.toLowerCase();
  const match = Object.keys(DEEPSEEK_PRICING).find((key5) => model.includes(key5));
  return match ? DEEPSEEK_PRICING[match] : void 0;
}
function estimateProviderCost(config, usage) {
  if (Number.isFinite(usage.cost)) {
    return {
      amount: Math.max(0, Number(usage.cost)),
      currency: usage.currency?.trim() || "USD",
      estimated: false
    };
  }
  const pricing = providerPricing(config);
  if (!pricing) return void 0;
  const promptTokens = Math.max(0, usage.prompt_tokens ?? 0);
  const cacheHitTokens = Math.max(0, usage.prompt_cache_hit_tokens ?? 0);
  const cacheMissTokens = Math.max(
    0,
    usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens)
  );
  const completionTokens = Math.max(0, usage.completion_tokens ?? 0);
  if (!promptTokens && !cacheHitTokens && !cacheMissTokens && !completionTokens) return void 0;
  return {
    amount: (cacheHitTokens * pricing.inputCacheHitPerMillion + cacheMissTokens * pricing.inputCacheMissPerMillion + completionTokens * pricing.outputPerMillion) / 1e6,
    currency: pricing.currency,
    estimated: true
  };
}
var ProviderError = class extends Error {
  constructor(message, status, retryable, retryAfterMs) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.name = "ProviderError";
  }
};
async function createOpenAICompatibleCompletion(config, messages, tools, signal) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ model: config.model, messages, tools, temperature: 0 }),
    signal
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2e3);
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ProviderError(
      `${config.name} API ${response.status}: ${detail}`,
      response.status,
      response.status === 408 || response.status === 429 || response.status >= 500,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1e3 : void 0
    );
  }
  const payload = await response.json();
  if (payload.usage) {
    telemetry.calls++;
    telemetry.promptTokens += payload.usage.prompt_tokens ?? 0;
    telemetry.completionTokens += payload.usage.completion_tokens ?? 0;
    telemetry.totalTokens += payload.usage.total_tokens ?? 0;
    telemetry.cacheHitTokens += payload.usage.prompt_cache_hit_tokens ?? 0;
    telemetry.cacheMissTokens += payload.usage.prompt_cache_miss_tokens ?? 0;
    telemetry.lastTotalTokens = payload.usage.total_tokens ?? 0;
    telemetry.lastCacheHitTokens = payload.usage.prompt_cache_hit_tokens ?? 0;
    telemetry.lastProviderId = config.id;
    telemetry.lastProviderName = config.name;
    telemetry.lastModel = config.model;
    const charge = estimateProviderCost(config, payload.usage);
    telemetry.lastCost = charge?.amount ?? null;
    if (charge) {
      telemetry.totalCost += charge.amount;
      telemetry.costCurrency = charge.currency;
      telemetry.costEstimated = charge.estimated;
    }
  }
  return payload;
}
var openAICompatibleProvider = {
  id: "openai-compatible",
  createChatCompletion: createOpenAICompatibleCompletion
};

// ../src/providers/deepseek.ts
var deepSeekProvider = {
  id: "deepseek",
  createChatCompletion: createOpenAICompatibleCompletion
};

// ../src/providers/mimo.ts
var mimoProvider = {
  id: "mimo",
  createChatCompletion: createOpenAICompatibleCompletion
};

// ../src/providers/registry.ts
var providers = /* @__PURE__ */ new Map([
  [deepSeekProvider.id, deepSeekProvider],
  [mimoProvider.id, mimoProvider]
]);
function getModelProvider(config) {
  const id = config.id.toLowerCase();
  const name = config.name.toLowerCase();
  if (id.includes("mimo") || name.includes("mimo")) return mimoProvider;
  return providers.get(id) ?? openAICompatibleProvider;
}

// ../src/config/settings.ts
import { AsyncLocalStorage } from "node:async_hooks";

// ../src/config/paths.ts
function appDataDir() {
  return appDataPath();
}

// ../src/config/settings.ts
var SERVICE = "com.youjunmao.ai-agent";
var LEGACY_ACCOUNT = "deepseek-api-key";
var DEFAULT_PROVIDER_ID = "deepseek";
var DEFAULT_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];
var DEFAULT_UPDATE_URL = "https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest";
var IMAGE_GENERATION_ACCOUNT = "image-generation:volcengine-ark:api-key";
var DEFAULT_IMAGE_MODEL = "doubao-seedream-4-5-251128";
var DEFAULT_IMAGE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
var workspaceContext = new AsyncLocalStorage();
function settingsPath() {
  return `${appDataDir()}/settings.json`;
}
function settingsFilePath() {
  return settingsPath();
}
function env(name) {
  try {
    return environment(name);
  } catch {
    return void 0;
  }
}
function defaultUpdateSettings() {
  return {
    checkOnStartup: true,
    updateUrl: env("AI_AGENT_UPDATE_URL")?.trim() || DEFAULT_UPDATE_URL
  };
}
function normalizeImageGenerationSettings(input) {
  return {
    provider: "volcengine-ark",
    baseUrl: DEFAULT_IMAGE_BASE_URL,
    model: String(input?.model ?? DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL
  };
}
function normalizeUpdateSettings(input) {
  const fallback = defaultUpdateSettings();
  return {
    checkOnStartup: input?.checkOnStartup ?? fallback.checkOnStartup,
    updateUrl: input?.updateUrl?.trim() || fallback.updateUrl,
    lastCheckAt: input?.lastCheckAt,
    latestVersion: input?.latestVersion,
    releaseUrl: input?.releaseUrl
  };
}
function normalizeModels(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((item) => String(item).trim()).filter(Boolean))];
}
function normalizeBaseUrl(input) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Base URL \u4E0D\u80FD\u4E3A\u7A7A");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Base URL \u683C\u5F0F\u65E0\u6548");
  }
  const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    throw new Error("Base URL \u5FC5\u987B\u4F7F\u7528 HTTPS\uFF1B\u672C\u5730\u5F00\u53D1\u53EA\u5141\u8BB8 localhost HTTP");
  }
  let normalized = raw.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    normalized = normalized.slice(0, -"/chat/completions".length).replace(/\/+$/, "");
  }
  return normalized;
}
function sanitizeProviderId(value2) {
  return value2.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "provider";
}
function uniqueProviderId(base, used) {
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
function defaultDeepSeekProvider() {
  return {
    id: DEFAULT_PROVIDER_ID,
    name: "DeepSeek \u5B98\u65B9",
    protocol: "openai",
    baseUrl: env("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
    models: DEFAULT_MODELS,
    defaultModel: env("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
    builtIn: true,
    apiKeyEnv: "DEEPSEEK_API_KEY"
  };
}
function legacyModels(parsed, fallback) {
  const savedModels = normalizeModels(parsed.models);
  const legacyDefaults = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"];
  if (!savedModels.length) return fallback.models;
  return savedModels.join("\n") === legacyDefaults.join("\n") ? DEFAULT_MODELS : savedModels;
}
function normalizeStoredProvider(raw, used) {
  const name = String(raw.name ?? raw.id ?? "\u81EA\u5B9A\u4E49\u4F9B\u5E94\u5546").trim() || "\u81EA\u5B9A\u4E49\u4F9B\u5E94\u5546";
  const id = raw.id ? uniqueProviderId(String(raw.id), used) : uniqueProviderId(name, used);
  const models = normalizeModels(raw.models);
  if (!models.length) throw new Error(`${name} \u81F3\u5C11\u914D\u7F6E\u4E00\u4E2A\u6A21\u578B`);
  const defaultModel = raw.defaultModel && models.includes(raw.defaultModel) ? raw.defaultModel : models[0];
  return {
    id,
    name,
    protocol: "openai",
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    models,
    defaultModel,
    builtIn: raw.builtIn === true || id === DEFAULT_PROVIDER_ID,
    apiKeyEnv: raw.apiKeyEnv?.trim() || (id === DEFAULT_PROVIDER_ID ? "DEEPSEEK_API_KEY" : void 0)
  };
}
function providersFromStored(parsed) {
  const used = /* @__PURE__ */ new Set();
  const fromProviders = Array.isArray(parsed.providers) ? parsed.providers.flatMap((provider) => {
    try {
      return [normalizeStoredProvider(provider, used)];
    } catch {
      return [];
    }
  }) : [];
  if (fromProviders.length) return fromProviders;
  const fallback = defaultDeepSeekProvider();
  const models = legacyModels(parsed, fallback);
  const defaultModel = parsed.defaultModel && models.includes(parsed.defaultModel) ? parsed.defaultModel : models[0];
  return [
    normalizeStoredProvider({
      ...fallback,
      baseUrl: parsed.baseUrl?.trim() || fallback.baseUrl,
      models,
      defaultModel
    }, used)
  ];
}
async function readStored() {
  const fallbackProvider = defaultDeepSeekProvider();
  const fallback = {
    providers: [fallbackProvider],
    defaultProviderId: fallbackProvider.id,
    workspace: void 0,
    workspaces: [],
    update: defaultUpdateSettings(),
    imageGeneration: normalizeImageGenerationSettings()
  };
  try {
    const parsed = JSON.parse(await readUtf8(settingsPath()));
    const providers2 = providersFromStored(parsed);
    const workspaces = parsed.workspaces ?? (parsed.workspace ? [parsed.workspace] : []);
    const workspace = parsed.workspace && workspaces.includes(parsed.workspace) ? parsed.workspace : workspaces[0];
    const defaultProviderId = providers2.some((item) => item.id === parsed.defaultProviderId) ? parsed.defaultProviderId : providers2[0].id;
    return {
      providers: providers2,
      defaultProviderId,
      workspace,
      workspaces,
      update: normalizeUpdateSettings(parsed.update),
      imageGeneration: normalizeImageGenerationSettings(parsed.imageGeneration)
    };
  } catch (error) {
    if (isNotFound(error)) return fallback;
    throw error;
  }
}
async function writeStored(settings) {
  const target = settingsPath();
  await writeJsonAtomic(target, settings);
}
function keychainAccount(providerId) {
  return providerId === DEFAULT_PROVIDER_ID ? LEGACY_ACCOUNT : `provider:${providerId}:api-key`;
}
function providerEnvName(provider) {
  return provider.apiKeyEnv || `${provider.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}
async function readProviderKey(provider) {
  const envName = providerEnvName(provider);
  const envKey = envName ? env(envName) : void 0;
  if (envKey) return envKey;
  return await readSecret(SERVICE, keychainAccount(provider.id));
}
async function saveProviderKey(providerId, apiKey) {
  await writeSecret(SERVICE, keychainAccount(providerId), apiKey.trim());
}
async function readImageGenerationKey() {
  return env("ARK_API_KEY") || await readSecret(SERVICE, IMAGE_GENERATION_ACCOUNT);
}
async function saveImageGenerationKey(apiKey) {
  await writeSecret(SERVICE, IMAGE_GENERATION_ACCOUNT, apiKey.trim());
}
function modelValue(providerId, model) {
  return `${encodeURIComponent(providerId)}:${encodeURIComponent(model)}`;
}
function modelOptions(providers2) {
  return providers2.flatMap(
    (provider) => provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      model,
      value: modelValue(provider.id, model),
      label: `${provider.name} \xB7 ${model}`
    }))
  );
}
async function getPublicSettings() {
  const stored = await readStored();
  const providers2 = await Promise.all((stored.providers ?? []).map(async (provider) => ({
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    models: provider.models,
    defaultModel: provider.defaultModel,
    builtIn: provider.builtIn,
    hasApiKey: Boolean(await readProviderKey(provider))
  })));
  const defaultProvider = providers2.find((item) => item.id === stored.defaultProviderId) ?? providers2[0];
  return {
    baseUrl: defaultProvider.baseUrl,
    models: defaultProvider.models,
    defaultModel: defaultProvider.defaultModel,
    hasApiKey: defaultProvider.hasApiKey,
    defaultProviderId: defaultProvider.id,
    providers: providers2,
    modelOptions: modelOptions(providers2),
    workspace: stored.workspace,
    workspaces: stored.workspaces ?? [],
    update: normalizeUpdateSettings(stored.update),
    settingsPath: settingsPath(),
    imageGeneration: {
      ...normalizeImageGenerationSettings(stored.imageGeneration),
      hasApiKey: Boolean(await readImageGenerationKey())
    }
  };
}
function normalizeProviderInput(input, used, existing) {
  const candidate = {
    ...existing,
    ...input,
    id: input.id || existing?.id,
    name: input.name || existing?.name,
    protocol: "openai",
    builtIn: existing?.builtIn || input.builtIn,
    apiKeyEnv: existing?.apiKeyEnv || input.apiKeyEnv
  };
  return normalizeStoredProvider(candidate, used);
}
async function saveSettings(input) {
  const current = await readStored();
  const providerInputs = Array.isArray(input.providers) && input.providers.length ? input.providers : [{
    id: DEFAULT_PROVIDER_ID,
    name: "DeepSeek \u5B98\u65B9",
    baseUrl: input.baseUrl,
    models: input.models,
    defaultModel: input.defaultModel,
    apiKey: input.apiKey,
    builtIn: true,
    apiKeyEnv: "DEEPSEEK_API_KEY"
  }];
  const used = /* @__PURE__ */ new Set();
  const providers2 = providerInputs.map((providerInput) => {
    const existing = current.providers?.find((item) => item.id === providerInput.id);
    return normalizeProviderInput(providerInput, used, existing);
  });
  if (!providers2.length) throw new Error("\u81F3\u5C11\u914D\u7F6E\u4E00\u4E2A\u6A21\u578B\u4F9B\u5E94\u5546");
  for (let index = 0; index < providers2.length; index++) {
    const apiKey = providerInputs[index]?.apiKey?.trim();
    if (apiKey) await saveProviderKey(providers2[index].id, apiKey);
  }
  const imageGeneration2 = normalizeImageGenerationSettings({
    ...current.imageGeneration,
    model: input.imageGeneration?.model ?? current.imageGeneration?.model
  });
  const imageApiKey = input.imageGeneration?.apiKey?.trim();
  if (imageApiKey) await saveImageGenerationKey(imageApiKey);
  const defaultProviderId = providers2.some((item) => item.id === input.defaultProviderId) ? input.defaultProviderId : providers2[0].id;
  await writeStored({
    providers: providers2,
    defaultProviderId,
    workspace: current.workspace,
    workspaces: current.workspaces ?? [],
    update: normalizeUpdateSettings(current.update),
    imageGeneration: imageGeneration2
  });
  return await getPublicSettings();
}
async function saveUpdateSettings(input) {
  const current = await readStored();
  const update = normalizeUpdateSettings({ ...current.update, ...input });
  if (update.updateUrl && !update.updateUrl.startsWith("https://") && !update.updateUrl.startsWith("http://127.0.0.1") && !update.updateUrl.startsWith("http://localhost")) {
    throw new Error("\u66F4\u65B0\u6E90\u5FC5\u987B\u4F7F\u7528 HTTPS\uFF1B\u672C\u5730\u5F00\u53D1\u53EA\u5141\u8BB8 localhost HTTP");
  }
  await writeStored({ ...current, update });
  return await getPublicSettings();
}
async function getWorkspace() {
  const scoped = workspaceContext.getStore();
  if (scoped) return scoped;
  const workspace = (await readStored()).workspace;
  if (!workspace) throw new Error("\u8BF7\u5148\u70B9\u51FB\u5DE6\u4FA7\u201C\u65B0\u76EE\u5F55\u201D\u9009\u62E9\u5DE5\u4F5C\u76EE\u5F55");
  const { stat: stat7 } = await import("node:fs/promises");
  if (!(await stat7(workspace)).isDirectory()) throw new Error("\u4FDD\u5B58\u7684\u5DE5\u4F5C\u76EE\u5F55\u5DF2\u5931\u6548");
  return workspace;
}
async function chooseWorkspace() {
  const workspace = await chooseFolder();
  if (!workspace) throw new Error("\u5DF2\u53D6\u6D88\u9009\u62E9\u76EE\u5F55");
  const current = await readStored();
  const workspaces = [.../* @__PURE__ */ new Set([...current.workspaces ?? [], workspace])];
  await writeStored({ ...current, workspace, workspaces });
  return await getPublicSettings();
}
async function selectWorkspace(workspace) {
  const current = await readStored();
  if (!(current.workspaces ?? []).includes(workspace)) throw new Error("\u76EE\u5F55\u4E0D\u5B58\u5728");
  await writeStored({ ...current, workspace });
  return await getPublicSettings();
}
async function removeWorkspace(workspace) {
  const current = await readStored();
  const workspaces = (current.workspaces ?? []).filter((item) => item !== workspace);
  const active2 = current.workspace === workspace ? workspaces[0] : current.workspace;
  await writeStored({ ...current, workspace: active2, workspaces });
  return await getPublicSettings();
}
async function resolveProviderConfig(providerId, model) {
  const stored = await readStored();
  const provider = (providerId ? stored.providers?.find((item) => item.id === providerId) : stored.providers?.find((item) => item.id === stored.defaultProviderId)) ?? stored.providers?.[0];
  if (!provider) throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u6A21\u578B\u4F9B\u5E94\u5546");
  const apiKey = await readProviderKey(provider);
  if (!apiKey) throw new Error(`\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E ${provider.name} API Key`);
  const selected = model || provider.defaultModel;
  if (!provider.models.includes(selected)) {
    throw new Error(`\u6240\u9009\u6A21\u578B\u672A\u914D\u7F6E\uFF1A${provider.name} / ${selected}`);
  }
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    apiKey,
    baseUrl: provider.baseUrl.replace(/\/$/, ""),
    model: selected
  };
}
async function resolveImageGenerationConfig() {
  const stored = await readStored();
  const imageGeneration2 = normalizeImageGenerationSettings(stored.imageGeneration);
  const apiKey = await readImageGenerationKey();
  if (!apiKey) throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E \u2192 \u56FE\u7247\u751F\u6210\u4E2D\u914D\u7F6E\u706B\u5C71\u65B9\u821F API Key");
  return { ...imageGeneration2, apiKey };
}

// ../src/contracts.ts
var DEFAULT_RUN_BUDGET = Object.freeze({
  iterations: 40,
  toolCalls: 80,
  outputChars: 25e4,
  cost: 40
});
function validateLimit(kind2, value2) {
  if (!Number.isFinite(value2) || value2 < 0) {
    throw new Error(`${kind2} budget must be a non-negative finite number`);
  }
  return value2;
}
function resolveRunBudget(value2) {
  const resolved = { ...DEFAULT_RUN_BUDGET, ...value2 };
  for (const kind2 of Object.keys(resolved)) {
    resolved[kind2] = validateLimit(kind2, resolved[kind2]);
  }
  return resolved;
}
var BudgetExceededError = class extends Error {
  constructor(kind2, used, limit) {
    super(`${kind2} budget exceeded (${used}/${limit})`);
    this.kind = kind2;
    this.used = used;
    this.limit = limit;
    this.name = "BudgetExceededError";
  }
};
var RuntimeBudget = class _RuntimeBudget {
  constructor(limit, parent) {
    this.parent = parent;
    this.limit = resolveRunBudget(limit);
  }
  used = { iterations: 0, toolCalls: 0, outputChars: 0, cost: 0 };
  limit;
  consume(kind2, amount = 1) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`${kind2} budget consumption must be a non-negative finite number`);
    }
    const next = this.used[kind2] + amount;
    if (next > this.limit[kind2]) throw new BudgetExceededError(kind2, next, this.limit[kind2]);
    this.parent?.consume(kind2, amount);
    this.used[kind2] = next;
  }
  child(limit = {}) {
    const remaining = this.remaining();
    const childLimit = resolveRunBudget({ ...remaining, ...limit });
    for (const kind2 of Object.keys(childLimit)) {
      childLimit[kind2] = Math.min(childLimit[kind2], remaining[kind2]);
    }
    return new _RuntimeBudget(childLimit, this);
  }
  remaining() {
    return {
      iterations: Math.max(0, this.limit.iterations - this.used.iterations),
      toolCalls: Math.max(0, this.limit.toolCalls - this.used.toolCalls),
      outputChars: Math.max(0, this.limit.outputChars - this.used.outputChars),
      cost: Math.max(0, this.limit.cost - this.used.cost)
    };
  }
  snapshot() {
    return { used: { ...this.used }, limit: { ...this.limit }, remaining: this.remaining() };
  }
};

// ../src/tool_policy.ts
var DEFAULT_TOOL_OUTPUT = 5e4;
var PRINCIPAL_TTL_MS = 60 * 60 * 1e3;
var mutatingTools = /* @__PURE__ */ new Set([
  "write_file",
  "edit_file",
  "memory_append",
  "memory_replace",
  "task_graph_write",
  "todo_write",
  "background_start",
  "background_cancel",
  "cron_write",
  "worktree_create",
  "worktree_remove",
  "mcp_call",
  "generate_image",
  "task_create",
  "task_checkpoint",
  "task_verify",
  "worker_enqueue",
  "worker_lease",
  "worker_settle"
]);
var externalTools = /* @__PURE__ */ new Set([
  "bash",
  "background_start",
  "worktree_agent",
  "mcp_servers",
  "mcp_list_tools",
  "mcp_call",
  "generate_image"
]);
var dangerousTools = /* @__PURE__ */ new Set(["bash"]);
var ToolPolicyError = class extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
    this.name = "ToolPolicyError";
  }
};
function inferRisk(name) {
  if (dangerousTools.has(name)) return "dangerous";
  if (externalTools.has(name)) return "external";
  if (mutatingTools.has(name)) return "mutating";
  return "read-only";
}
function inferredScopes(risk) {
  return [risk === "read-only" ? "read" : risk];
}
function validateMaxOutput(maxOutput) {
  if (!Number.isFinite(maxOutput) || !Number.isInteger(maxOutput) || maxOutput < 128) {
    throw new ToolPolicyError("invalid", "tool maxOutput must be an integer of at least 128");
  }
  return maxOutput;
}
function normalizeToolPolicy(definition12, policy = {}) {
  const name = definition12.function.name.trim();
  if (!name) throw new ToolPolicyError("invalid", "tool policy requires a tool name");
  const risk = policy.risk ?? inferRisk(name);
  const scopes = [...policy.scopes ?? inferredScopes(risk)].map((scope) => scope.trim()).filter(
    Boolean
  );
  if (!scopes.length) throw new ToolPolicyError("invalid", `${name} tool policy requires scopes`);
  return {
    name,
    mutation: policy.mutation ?? risk !== "read-only",
    risk,
    scopes,
    maxOutput: validateMaxOutput(policy.maxOutput ?? DEFAULT_TOOL_OUTPUT)
  };
}
function createPrincipal(mode, supplied) {
  if (supplied) return supplied;
  const scopes = mode === "full" ? ["read", "mutating", "external", "dangerous"] : ["read", "mutating", "external", "dangerous"];
  return {
    id: `local-${mode}`,
    scopes: new Set(scopes),
    expiresAt: Date.now() + PRINCIPAL_TTL_MS
  };
}
function authorizeToolPolicy(policy, principal) {
  if (!principal.id.trim() || !Number.isFinite(principal.expiresAt)) {
    throw new ToolPolicyError("invalid", "tool principal is invalid");
  }
  if (principal.expiresAt <= Date.now()) {
    throw new ToolPolicyError("expired", `tool policy denied: principal ${principal.id} expired`);
  }
  const missing = policy.scopes.filter((scope) => !principal.scopes.has(scope));
  if (missing.length) {
    throw new ToolPolicyError(
      "scope",
      `tool policy denied: ${policy.name} requires scope ${missing.join(", ")}`
    );
  }
  return policy;
}
function boundedToolOutput(value2, policy) {
  if (value2.length <= policy.maxOutput) return value2;
  const marker = `\u2026\uFF08\u5DE5\u5177\u8F93\u51FA\u5DF2\u622A\u65AD\uFF0C\u539F\u59CB ${value2.length.toLocaleString()} \u5B57\u7B26\uFF09`;
  const keep = Math.max(0, policy.maxOutput - marker.length);
  return `${value2.slice(0, keep)}${marker.slice(0, policy.maxOutput - keep)}`;
}

// ../src/registry.ts
var ToolRegistry = class {
  #tools = /* @__PURE__ */ new Map();
  register(definition12, handler, policy = {}) {
    const name = definition12.function.name.trim();
    if (!name) throw new Error("Tool name is required");
    if (this.#tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    this.#tools.set(name, { definition: definition12, handler, policy: normalizeToolPolicy(definition12, policy) });
  }
  get(name) {
    return this.#tools.get(name);
  }
  definitions() {
    return [...this.#tools.values()].map((tool) => tool.definition);
  }
  names() {
    return [...this.#tools.keys()];
  }
};

// ../src/prompt.ts
var PromptRegistry = class {
  #sections = /* @__PURE__ */ new Map();
  register(section) {
    if (!section.id.trim() || !section.content.trim()) throw new Error("Invalid prompt section");
    this.#sections.set(section.id, { ...section, content: section.content.trim() });
  }
  build(workspace) {
    const core = {
      id: "core",
      title: "Identity and workspace",
      priority: 0,
      content: `You are AI Agent, a local coding harness working in ${workspace}. Continue until the user's scoped task is complete. Verify outcomes and respect permission boundaries.`
    };
    const sections = [core, ...this.#sections.values()].sort(
      (a, b) => a.priority - b.priority || a.id.localeCompare(b.id)
    );
    return {
      sections,
      prompt: sections.map((section) => `## ${section.title}
${section.content}`).join("\n\n")
    };
  }
};

// ../src/permissions.ts
var hardDenied = [
  /rm\s+-[^\n]*r[^\n]*f[^\n]*\s+\/(?:\s|$)/i,
  /\bsudo\b/i,
  /\b(?:shutdown|reboot|mkfs)\b/i,
  /\bdd\s+if=/i
];
var MAX_FIELD_PREVIEW = 360;
function truncate(value2, max = MAX_FIELD_PREVIEW) {
  const normalized = value2.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}\u2026\uFF08\u5DF2\u622A\u65AD\uFF0C\u5171 ${normalized.length} \u5B57\u7B26\uFF09`;
}
function describeValue(value2) {
  if (typeof value2 === "string") return truncate(value2);
  if (typeof value2 === "number" || typeof value2 === "boolean" || value2 === null) {
    return String(value2);
  }
  if (Array.isArray(value2)) return `\u6570\u7EC4\uFF0C${value2.length} \u9879`;
  if (typeof value2 === "object" && value2) return `\u5BF9\u8C61\uFF0C${Object.keys(value2).length} \u4E2A\u5B57\u6BB5`;
  return String(value2);
}
function summarizePermissionInput(request) {
  const input = request.input;
  if (request.name === "write_file") {
    const content = String(input.content ?? "");
    return [
      `path: ${String(input.path ?? "\u672A\u63D0\u4F9B")}`,
      `content: ${content.length.toLocaleString()} \u5B57\u7B26`,
      `preview: ${truncate(content)}`
    ].join("\n");
  }
  if (request.name === "edit_file") {
    return [
      `path: ${String(input.path ?? "\u672A\u63D0\u4F9B")}`,
      input.oldText !== void 0 ? `oldText: ${describeValue(input.oldText)}` : void 0,
      input.newText !== void 0 ? `newText: ${describeValue(input.newText)}` : void 0
    ].filter(Boolean).join("\n");
  }
  if (request.name === "bash" || request.name === "background_start") {
    return `command: ${truncate(String(input.command ?? ""))}`;
  }
  if (request.name === "mcp_call") {
    return [
      `server: ${String(input.server ?? "\u672A\u63D0\u4F9B")}`,
      `tool: ${String(input.tool ?? "\u672A\u63D0\u4F9B")}`,
      input.arguments !== void 0 ? `arguments: ${describeValue(input.arguments)}` : void 0
    ].filter(Boolean).join("\n");
  }
  return Object.entries(input).map(([key5, value2]) => `${key5}: ${describeValue(value2)}`).join("\n");
}
async function authorize(request, mode, policy) {
  const command = String(request.input.command ?? "");
  if (mode !== "full" && ["bash", "background_start"].includes(request.name) && hardDenied.some((pattern) => pattern.test(command))) throw new Error("Permission denied: system-level dangerous command");
  const mutating = policy ? policy.mutation || policy.risk !== "read-only" : [
    "bash",
    "write_file",
    "edit_file",
    "background_start",
    "cron_write",
    "worktree_create",
    "worktree_remove",
    "mcp_call",
    "generate_image"
  ].includes(request.name);
  if (mode !== "ask" || !mutating) return;
  const allowed = confirmPermission(
    `AI Agent \u8BF7\u6C42\u6743\u9650

${request.name}
${summarizePermissionInput(request)}

\u662F\u5426\u5141\u8BB8\uFF1F`
  );
  if (!allowed) throw new Error("Permission denied by user");
}

// ../src/context.ts
var BUDGET = 24e3;
var KEEP = 10;
var SUMMARY = 8e3;
function compactHistory(history) {
  const before = history.reduce((sum, item) => sum + String(item.content ?? "").length, 0);
  if (before <= BUDGET) return { history, compacted: false, before, after: before };
  const older = history.slice(0, -KEEP), recent = history.slice(-KEEP);
  let summary = `[Earlier conversation compacted]
${older.map(
    (item, index) => `${index + 1}. ${item.role}: ${String(item.content ?? "").replace(/\s+/g, " ").slice(0, 600)}`
  ).join("\n")}`;
  if (summary.length > SUMMARY) summary = `${summary.slice(0, SUMMARY)}
[summary truncated]`;
  const compacted = [{ role: "user", content: summary }, ...recent];
  return {
    history: compacted,
    compacted: true,
    before,
    after: compacted.reduce((sum, item) => sum + String(item.content ?? "").length, 0)
  };
}

// ../src/trace.ts
var TraceBook = class {
  traceId = crypto.randomUUID();
  spans = [];
  start(name, kind2, parent) {
    const span = {
      traceId: this.traceId,
      spanId: crypto.randomUUID().slice(0, 12),
      parentSpanId: parent?.spanId,
      name,
      kind: kind2,
      startedAt: performance.now()
    };
    this.spans.push(span);
    return span;
  }
  end(span, status) {
    if (span.durationMs === void 0) {
      span.durationMs = Math.max(0, Math.round(performance.now() - span.startedAt));
    }
    span.status = status;
    return span;
  }
  summary(root, status) {
    this.end(root, status);
    const childSpans = this.spans.filter((span) => span.spanId !== root.spanId);
    const errorSpans = childSpans.filter((span) => span.status === "error").length;
    const cancelledSpans = childSpans.filter((span) => span.status === "cancelled").length;
    return {
      traceId: this.traceId,
      rootSpanId: root.spanId,
      status,
      durationMs: root.durationMs ?? 0,
      spanCount: this.spans.length,
      providerCalls: this.spans.filter((span) => span.kind === "provider").length,
      toolCalls: this.spans.filter((span) => span.kind === "tool").length,
      errorSpans: errorSpans || (status === "error" ? 1 : 0),
      cancelledSpans: cancelledSpans || (status === "cancelled" ? 1 : 0),
      spans: this.spans.map((span) => ({ ...span }))
    };
  }
};

// ../src/runtime.ts
var AgentRuntime = class {
  //
  tools = new ToolRegistry();
  //
  prompts = new PromptRegistry();
  #resolveProviderConfig;
  #getModelProvider;
  //
  constructor(features, dependencies = {}) {
    this.#resolveProviderConfig = dependencies.resolveProviderConfig ?? resolveProviderConfig;
    this.#getModelProvider = dependencies.getModelProvider ?? getModelProvider;
    for (const feature of features) {
      feature.register({ tools: this.tools, prompts: this.prompts, run: this.run.bind(this) });
    }
  }
  //
  async run(options) {
    const traces = new TraceBook();
    const rootSpan = traces.start("agent.run", "run");
    let status = "ok";
    try {
      return await this.#run(options, traces, rootSpan);
    } catch (error) {
      status = options.signal?.aborted || error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "error";
      throw error;
    } finally {
      const summary = traces.summary(rootSpan, status);
      options.onEvent?.({
        type: "hook",
        name: "TraceSummary",
        detail: JSON.stringify(summary),
        traceId: summary.traceId,
        spanId: summary.rootSpanId,
        durationMs: summary.durationMs,
        traceStatus: summary.status
      });
    }
  }
  async #run(options, traces, rootSpan) {
    const emitHook = (event, span = rootSpan) => {
      options.onEvent?.({
        type: "hook",
        ...event,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId
      });
    };
    const emitTool = (event, span) => {
      options.onEvent?.({
        type: "tool",
        ...event,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        durationMs: span.durationMs,
        traceStatus: span.status
      });
    };
    const workspace = options.workspace ?? await getWorkspace();
    const principal = {
      ...createPrincipal(options.permissionMode ?? "ask", options.principal),
      subject: options.principal?.subject ?? "local-agent",
      tenant: options.principal?.tenant ?? "local"
    };
    const config = await this.#resolveProviderConfig(options.providerId, options.model);
    const compacted = compactHistory(options.history ?? []);
    const budget = options.budget instanceof RuntimeBudget ? options.budget : new RuntimeBudget(resolveRunBudget(options.budget));
    emitHook({
      name: "RunBudget",
      detail: JSON.stringify(budget.snapshot())
    });
    if (compacted.compacted) {
      emitHook({
        name: "ContextCompact",
        detail: `${compacted.before} \u2192 ${compacted.after} chars`
      });
    }
    const prompt = this.prompts.build(workspace);
    emitHook({
      name: "SystemPromptAssembled",
      detail: `${prompt.sections.length} sections \xB7 ${prompt.prompt.length} chars`
    });
    const messages = [
      { role: "system", content: prompt.prompt },
      ...compacted.history.filter((item) => item.role === "user" || item.role === "assistant"),
      { role: "user", content: options.query }
    ];
    let toolCount = 0;
    let usageEmitted = false;
    const emitUsage = () => {
      if (usageEmitted) return;
      usageEmitted = true;
      emitHook({
        name: "RunUsage",
        detail: JSON.stringify(budget.snapshot())
      });
    };
    try {
      while (true) {
        if (options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
        budget.consume("iterations");
        const response = await this.#complete(config, messages, options, budget, traces, rootSpan);
        const assistant = response.choices[0]?.message;
        if (!assistant) throw new Error("Model returned no message");
        const assistantContent = assistant.content ?? "";
        budget.consume("outputChars", assistantContent.length);
        messages.push(assistant);
        if (!assistant.tool_calls?.length) {
          emitUsage();
          emitHook({
            name: "Stop",
            detail: `${toolCount} tool calls \xB7 ${JSON.stringify(budget.snapshot().used)}`
          });
          return assistantContent;
        }
        for (const call of assistant.tool_calls) {
          budget.consume("toolCalls");
          const toolSpan = traces.start(`tool.${call.function.name}`, "tool", rootSpan);
          const tool = this.tools.get(call.function.name);
          let output4;
          try {
            if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);
            const input = JSON.parse(call.function.arguments);
            authorizeToolPolicy(tool.policy, principal);
            emitHook({
              name: "ToolPolicyAuthorized",
              detail: `${tool.policy.name} \xB7 ${tool.policy.risk} \xB7 scopes=${tool.policy.scopes.join(",")}`
            }, toolSpan);
            emitHook({ name: "PreToolUse", detail: call.function.name }, toolSpan);
            await authorize(
              { name: call.function.name, input },
              options.permissionMode ?? "ask",
              tool.policy
            );
            output4 = await tool.handler(input, {
              workspace,
              signal: options.signal,
              budget,
              principal
            });
            const bounded = boundedToolOutput(output4, tool.policy);
            if (bounded.length !== output4.length) {
              emitHook({
                name: "ToolOutputTruncated",
                detail: `${tool.policy.name} \xB7 ${output4.length} \u2192 ${bounded.length} chars`
              }, toolSpan);
            }
            output4 = bounded;
            if (call.function.name.startsWith("task_") && output4.startsWith('{"task":')) {
              emitHook({ name: "TaskState", detail: output4 }, toolSpan);
            }
            if (call.function.name.startsWith("worker_") && output4.startsWith('{"worker":')) {
              emitHook({ name: "WorkerState", detail: output4 }, toolSpan);
            }
            if ((call.function.name.startsWith("handoff_") || call.function.name === "agent_handoff") && output4.startsWith('{"handoff":')) {
              emitHook({ name: "HandoffState", detail: output4 }, toolSpan);
            }
            if ((call.function.name.startsWith("research_") || call.function.name === "grounded_research") && output4.startsWith('{"research":')) {
              emitHook({ name: "ResearchState", detail: output4 }, toolSpan);
            }
            if (call.function.name.startsWith("evaluation_") && output4.startsWith('{"evaluation":')) {
              emitHook({ name: "EvaluationState", detail: output4 }, toolSpan);
            }
            toolCount++;
            traces.end(toolSpan, "ok");
            emitHook({
              name: "PostToolUse",
              detail: `${call.function.name} \xB7 ${output4.length} chars`
            }, toolSpan);
          } catch (error) {
            traces.end(toolSpan, options.signal?.aborted ? "cancelled" : "error");
            if (error instanceof ToolPolicyError) {
              emitHook({
                name: "ToolPolicyDenied",
                detail: `${call.function.name} \xB7 ${error.reason} \xB7 ${error.message}`
              }, toolSpan);
            }
            if (error instanceof BudgetExceededError) throw error;
            output4 = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }
          output4 = tool ? boundedToolOutput(output4, tool.policy) : output4;
          budget.consume("outputChars", output4.length);
          emitTool({
            name: call.function.name,
            input: call.function.arguments,
            output: output4
          }, toolSpan);
          messages.push({ role: "tool", tool_call_id: call.id, content: output4 });
        }
      }
    } catch (error) {
      emitUsage();
      if (error instanceof BudgetExceededError) {
        emitHook({ name: "BudgetExceeded", detail: error.message });
      }
      throw error;
    }
  }
  //
  async #complete(config, messages, options, budget, traces, parent) {
    const delays = [600, 1200, 2400];
    for (let attempt = 0; ; attempt++) {
      const providerSpan = traces.start("provider.chat", "provider", parent);
      try {
        budget.consume("cost");
        const response = await this.#getModelProvider(config).createChatCompletion(
          config,
          messages,
          this.tools.definitions(),
          options.signal
        );
        traces.end(providerSpan, "ok");
        return response;
      } catch (error) {
        traces.end(providerSpan, options.signal?.aborted ? "cancelled" : "error");
        if (options.signal?.aborted) throw error;
        const retryable = error instanceof ProviderError ? error.retryable : error instanceof TypeError;
        if (!retryable || attempt >= delays.length) throw error;
        const delay = error instanceof ProviderError && error.retryAfterMs ? Math.min(error.retryAfterMs, 1e4) : delays[attempt];
        options.onEvent?.({
          type: "hook",
          name: "ErrorRecovery",
          detail: `retry ${attempt + 1}/3 \xB7 ${delay}ms`,
          traceId: providerSpan.traceId,
          spanId: providerSpan.spanId,
          parentSpanId: providerSpan.parentSpanId,
          durationMs: providerSpan.durationMs,
          traceStatus: providerSpan.status
        });
        await new Promise((resolve4, reject) => {
          const timer = setTimeout(resolve4, delay);
          options.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Generation stopped", "AbortError"));
          }, { once: true });
        });
      }
    }
  }
};

// ../src/features/core_tools.ts
import { isAbsolute, relative, resolve } from "node:path";
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
function safePath(workspace, requested) {
  const root = resolve(workspace), path2 = resolve(root, requested), rel = relative(root, path2);
  if (rel === ".." || rel.startsWith(`..${isWindows ? "\\" : "/"}`) || isAbsolute(rel)) throw new Error(`Path escapes workspace: ${requested}`);
  return path2;
}
var definition = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } }
});
var coreTools = {
  id: "core-tools",
  register({ tools, prompts }) {
    tools.register(
      definition("bash", "Run a shell command in the workspace", { command: { type: "string" } }, [
        "command"
      ]),
      async (input, context) => {
        const command = String(input.command ?? ""), shell = isWindows ? "cmd.exe" : "/bin/sh";
        const result = await runCommand(
          shell,
          isWindows ? ["/d", "/s", "/c", command] : ["-c", command],
          { cwd: context.workspace }
        );
        return (result.stdout + result.stderr || `(exit ${result.code})`).slice(0, 5e4);
      }
    );
    tools.register(
      definition("read_file", "Read a UTF-8 workspace file", {
        path: { type: "string" },
        limit: { type: "number" }
      }, ["path"]),
      async (input, context) => {
        const text4 = await readFile2(safePath(context.workspace, String(input.path ?? "")), "utf8");
        return (typeof input.limit === "number" ? text4.split("\n").slice(0, input.limit).join("\n") : text4).slice(0, 5e4);
      }
    );
    tools.register(
      definition("write_file", "Write a UTF-8 workspace file", {
        path: { type: "string" },
        content: { type: "string" }
      }, ["path", "content"]),
      async (input, context) => {
        const path2 = safePath(context.workspace, String(input.path ?? ""));
        await mkdir2(dirname2(path2), { recursive: true });
        await writeFile2(path2, String(input.content ?? ""), "utf8");
        return `Wrote ${String(input.content ?? "").length} characters to ${input.path}`;
      }
    );
    tools.register(
      definition("edit_file", "Replace one unique text fragment", {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" }
      }, ["path", "old_text", "new_text"]),
      async (input, context) => {
        const path2 = safePath(context.workspace, String(input.path ?? "")), text4 = await readFile2(path2, "utf8"), oldText = String(input.old_text ?? "");
        if (!oldText || text4.split(oldText).length !== 2) {
          throw new Error(
            "old_text must match exactly once"
          );
        }
        await writeFile2(path2, text4.replace(oldText, String(input.new_text ?? "")), "utf8");
        return `Edited ${input.path}`;
      }
    );
    prompts.register({
      id: "workflow",
      title: "Execution workflow",
      priority: 10,
      content: "Inspect relevant context, use precise tools, make the smallest coherent change, verify in proportion to risk, and report concrete outcomes."
    });
  }
};

// ../src/features/productivity.ts
import { readdir, readFile as readFile3, stat } from "node:fs/promises";

// ../src/memory_service.ts
var MAX_RECORDS = 500;
var MAX_TEXT_LENGTH = 8e3;
var MAX_SOURCE_LENGTH = 500;
var MAX_TENANT_LENGTH = 120;
var MAX_IDEMPOTENCY_LENGTH = 120;
var MAX_IDEMPOTENCY_STORED = 40;
var MAX_QUERY_LENGTH = 1e3;
var MEMORY_ID = /^memory-[A-Za-z0-9-]{8,40}$/;
var KEY_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
var LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
var KINDS = /* @__PURE__ */ new Set(["semantic", "episodic", "procedural"]);
var workspaceLocks = /* @__PURE__ */ new Map();
var LEGACY_TENANT = "legacy";
function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException("Memory operation cancelled", "AbortError");
}
function normalizedText(value2, name, max) {
  const result = String(value2 ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return result;
}
function label(value2, name) {
  const result = normalizedText(value2, name, MAX_TENANT_LENGTH);
  if (!LABEL_PATTERN.test(result)) throw new Error(`${name} \u65E0\u6548`);
  return result;
}
function kind(value2) {
  const result = String(value2 ?? "");
  if (!KINDS.has(result)) throw new Error("memory kind \u65E0\u6548");
  return result;
}
function idempotencyKey(value2) {
  if (value2 === void 0 || value2 === "") return void 0;
  if (value2.length > MAX_IDEMPOTENCY_LENGTH || !KEY_PATTERN.test(value2)) {
    throw new Error("idempotency_key \u65E0\u6548");
  }
  return value2;
}
function scopedKey(operation, tenant, key5) {
  return `${operation}:${tenant}:${key5}`;
}
function validateRecord(raw) {
  if (!raw || typeof raw !== "object") throw new Error("memory record \u65E0\u6548");
  const value2 = raw;
  const revision = Number(value2.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("memory revision \u65E0\u6548");
  const storedKeys = Array.isArray(value2.idempotencyKeys) ? value2.idempotencyKeys.map((item) => normalizedText(item, "idempotency key", 300)).slice(
    0,
    MAX_IDEMPOTENCY_STORED
  ) : [];
  const expiresAt = value2.expiresAt === void 0 ? void 0 : Number(value2.expiresAt);
  if (expiresAt !== void 0 && !Number.isFinite(expiresAt)) throw new Error("expires_at \u65E0\u6548");
  return {
    id: validateId(value2.id),
    tenant: label(value2.tenant, "tenant"),
    kind: kind(value2.kind),
    text: normalizedText(value2.text, "text", MAX_TEXT_LENGTH),
    source: typeof value2.source === "string" ? normalizedText(value2.source, "source", MAX_SOURCE_LENGTH) : void 0,
    createdAt: normalizedText(value2.createdAt, "createdAt", 80),
    updatedAt: normalizedText(value2.updatedAt, "updatedAt", 80),
    expiresAt,
    deleted: value2.deleted === true,
    deletedAt: typeof value2.deletedAt === "string" ? value2.deletedAt : void 0,
    revision,
    idempotencyKeys: storedKeys
  };
}
function validateId(value2) {
  const id = String(value2 ?? "");
  if (!MEMORY_ID.test(id)) throw new Error("memory id \u65E0\u6548");
  return id;
}
async function workspaceKey(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function memoryPath(workspace) {
  return `${appDataDir()}/memory-service/${await workspaceKey(workspace)}.json`;
}
async function readRecords(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await memoryPath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_RECORDS) throw new Error("memory \u5B58\u50A8\u65E0\u6548");
    return value2.map(validateRecord);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveRecords(workspace, records) {
  if (records.length > MAX_RECORDS) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_RECORDS} \u6761 memory`);
  await writeJsonAtomic(await memoryPath(workspace), records);
}
function clone(record) {
  return { ...record, idempotencyKeys: [...record.idempotencyKeys] };
}
function touch(record) {
  record.revision += 1;
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
}
async function withWorkspaceLock(workspace, operation) {
  const previous = workspaceLocks.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  workspaceLocks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (workspaceLocks.get(workspace) === current) workspaceLocks.delete(workspace);
  }
}
function active(record, now = Date.now()) {
  return record.deleted !== true && (record.expiresAt === void 0 || record.expiresAt > now);
}
function tokens(value2) {
  return value2.toLocaleLowerCase().match(/[\p{L}\p{N}_]+|[\u3400-\u9fff]/gu) ?? [];
}
function citation(record) {
  return {
    id: record.id,
    tenant: record.tenant,
    kind: record.kind,
    source: record.source,
    createdAt: record.createdAt
  };
}
async function writeMemory(workspace, input, signal) {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const memoryKind = kind(input.kind);
  const text4 = normalizedText(input.text, "text", MAX_TEXT_LENGTH);
  const source = input.source === void 0 ? void 0 : normalizedText(input.source, "source", MAX_SOURCE_LENGTH);
  const expiresAt = input.expiresAt === void 0 ? void 0 : Number(input.expiresAt);
  if (expiresAt !== void 0 && !Number.isFinite(expiresAt)) throw new Error("expires_at \u65E0\u6548");
  const key5 = idempotencyKey(input.idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const operationKey = key5 && scopedKey("write", tenant, key5);
    const existing = operationKey && records.find((record2) => record2.idempotencyKeys.includes(operationKey));
    if (existing) return clone(existing);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: `memory-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      kind: memoryKind,
      text: text4,
      source,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      revision: 0,
      idempotencyKeys: operationKey ? [operationKey] : []
    };
    if (records.length >= MAX_RECORDS) throw new Error("memory record \u5DF2\u8FBE\u4E0A\u9650");
    records.unshift(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}
async function tombstoneMemory(workspace, id, tenant, idempotencyKeyValue, signal) {
  abortIfNeeded(signal);
  const memoryId = validateId(id);
  const normalizedTenant = label(tenant, "tenant");
  const key5 = idempotencyKey(idempotencyKeyValue);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = records.find((item) => item.id === memoryId);
    if (!record) throw new Error("memory \u4E0D\u5B58\u5728");
    if (record.tenant !== normalizedTenant) throw new Error("memory tenant \u4E0D\u5339\u914D");
    const operationKey = key5 && scopedKey("tombstone", normalizedTenant, key5);
    if (record.deleted || operationKey && record.idempotencyKeys.includes(operationKey)) {
      return clone(record);
    }
    record.deleted = true;
    record.deletedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}
async function replaceMemory(workspace, input, signal) {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const memoryKind = kind(input.kind);
  const text4 = normalizedText(input.text, "text", MAX_TEXT_LENGTH);
  const source = input.source === void 0 ? void 0 : normalizedText(input.source, "source", MAX_SOURCE_LENGTH);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const record2 of records) {
      if (record2.tenant === tenant && !record2.deleted) {
        record2.deleted = true;
        record2.deletedAt = now;
        touch(record2);
      }
    }
    const record = {
      id: `memory-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      kind: memoryKind,
      text: text4,
      source,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      idempotencyKeys: []
    };
    if (records.length >= MAX_RECORDS) throw new Error("memory record \u5DF2\u8FBE\u4E0A\u9650");
    records.unshift(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}
async function migrateLegacyMemory(workspace, signal) {
  abortIfNeeded(signal);
  const workspaceId = await workspaceKey(workspace);
  const legacyPath = `${appDataDir()}/memory/${workspaceId}.md`;
  let legacyText;
  try {
    legacyText = await readUtf8(legacyPath);
  } catch (error) {
    if (isNotFound(error)) return { migrated: false };
    throw error;
  }
  const text4 = legacyText.trim();
  if (!text4) return { migrated: false };
  const migrationKey = scopedKey("write", LEGACY_TENANT, `legacy-md-${workspaceId}`);
  const existing = (await readRecords(workspace)).find(
    (record2) => record2.idempotencyKeys.includes(migrationKey)
  );
  if (existing) return { migrated: false, record: clone(existing) };
  const record = await writeMemory(workspace, {
    tenant: LEGACY_TENANT,
    kind: "semantic",
    text: text4,
    source: "legacy-markdown-memory",
    idempotencyKey: `legacy-md-${workspaceId}`
  }, signal);
  return { migrated: true, record };
}
var legacyMemoryTenant = LEGACY_TENANT;
async function searchMemory(workspace, options, signal) {
  abortIfNeeded(signal);
  const tenant = label(options.tenant, "tenant");
  const query = normalizedText(options.query, "query", MAX_QUERY_LENGTH);
  const queryTerms = [...new Set(tokens(query))];
  if (!queryTerms.length) throw new Error("query \u65E0\u6709\u6548\u68C0\u7D22\u8BCD");
  const requestedKind = options.kind === void 0 ? void 0 : kind(options.kind);
  const limit = options.limit === void 0 ? 8 : Math.min(20, Math.max(1, Math.trunc(options.limit)));
  const now = Date.now();
  const records = await readRecords(workspace);
  return records.filter(
    (record) => record.tenant === tenant && active(record, now) && (!requestedKind || record.kind === requestedKind)
  ).map((record) => {
    const recordTerms = new Set(tokens(record.text));
    const matchedTerms = queryTerms.filter((term) => recordTerms.has(term));
    const phraseBonus = record.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? 0.25 : 0;
    return {
      id: record.id,
      tenant: record.tenant,
      kind: record.kind,
      text: record.text.slice(0, 1e3),
      score: matchedTerms.length / queryTerms.length + phraseBonus,
      matchedTerms,
      citation: citation(record)
    };
  }).filter((hit) => hit.matchedTerms.length > 0).sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id)
  ).slice(0, limit);
}
async function readMemoryRecords(workspace, options = {}) {
  const tenant = options.tenant === void 0 ? void 0 : label(options.tenant, "tenant");
  const records = await readRecords(workspace);
  return records.filter(
    (record) => (!tenant || record.tenant === tenant) && (options.includeDeleted || record.deleted !== true)
  ).map(clone);
}

// ../src/features/productivity.ts
var def = (name, description, properties, required = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } }
});
async function key(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function readOptional(path2) {
  try {
    return await readUtf8(path2);
  } catch (error) {
    if (isNotFound(error)) return "";
    throw error;
  }
}
async function writeData(path2, content) {
  await writeTextAtomic(path2, content);
}
var productivity = {
  id: "productivity",
  register({ tools, prompts }) {
    tools.register(
      def("todo_write", "Update the temporary checklist", { todos: { type: "array" } }, ["todos"]),
      async (input) => {
        if (!Array.isArray(input.todos)) throw new Error("todos must be an array");
        return `Updated ${input.todos.length} tasks (${input.todos.filter((item) => item?.status === "completed").length} completed)`;
      }
    );
    tools.register(
      def("memory_read", "[Deprecated] Read legacy project memory; use memory_search", {}),
      async (_input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const records = await readMemoryRecords(context.workspace, { tenant: legacyMemoryTenant });
        return records.map((record) => `- ${record.text}`).join("\n") || "(project memory is empty)";
      }
    );
    tools.register(
      def("memory_append", "[Deprecated] Append legacy memory; use memory_store", {
        content: { type: "string" }
      }, ["content"]),
      async (input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const record = await writeMemory(context.workspace, {
          tenant: legacyMemoryTenant,
          kind: "semantic",
          text: String(input.content ?? "").trim(),
          source: "deprecated-memory_append"
        }, context.signal);
        return `[Deprecated] Project memory updated via memory_service (${record.id})`;
      }
    );
    tools.register(
      def("memory_replace", "[Deprecated] Replace legacy memory; use memory_store", {
        content: { type: "string" }
      }, ["content"]),
      async (input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const record = await replaceMemory(context.workspace, {
          tenant: legacyMemoryTenant,
          kind: "semantic",
          text: String(input.content ?? "").trim(),
          source: "deprecated-memory_replace"
        }, context.signal);
        return `[Deprecated] Project memory replaced via memory_service (${record.id})`;
      }
    );
    tools.register(
      def("task_graph_read", "Read the persistent task graph", {}),
      async (_input, context) => await readOptional(`${appDataDir()}/task-graphs/${await key(context.workspace)}.json`) || JSON.stringify({ version: 1, nodes: [] })
    );
    tools.register(
      def("task_graph_write", "Replace the persistent task graph", { nodes: { type: "array" } }, [
        "nodes"
      ]),
      async (input, context) => {
        if (!Array.isArray(input.nodes)) throw new Error("nodes must be an array");
        const ids = /* @__PURE__ */ new Set();
        for (const raw of input.nodes) {
          const node = raw, id = String(node.id ?? "");
          if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || ids.has(id)) {
            throw new Error(
              "task ids are invalid or duplicated"
            );
          }
          ids.add(id);
        }
        for (const raw of input.nodes) {
          for (const dependency of Array.isArray(raw.dependsOn) ? raw.dependsOn : []) if (!ids.has(String(dependency))) throw new Error(`missing dependency: ${dependency}`);
        }
        const graph = { version: 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), nodes: input.nodes };
        await writeData(
          `${appDataDir()}/task-graphs/${await key(context.workspace)}.json`,
          `${JSON.stringify(graph, null, 2)}
`
        );
        return `Saved task graph: ${input.nodes.length} nodes`;
      }
    );
    tools.register(
      def("list_skills", "List workspace skills without loading them", {}),
      async (_input, context) => {
        const names = [];
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            for (const entry of await readdir(`${context.workspace}/${root}`, { withFileTypes: true })) {
              if (entry.isDirectory()) {
                try {
                  if ((await stat(`${context.workspace}/${root}/${entry.name}/SKILL.md`)).isFile()) names.push(entry.name);
                } catch {
                }
              }
            }
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }
        return [...new Set(names)].sort().join("\n") || "(no workspace skills found)";
      }
    );
    tools.register(
      def("load_skill", "Load one workspace SKILL.md", { name: { type: "string" } }, ["name"]),
      async (input, context) => {
        const name = String(input.name ?? "");
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("invalid skill name");
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            return (await readFile3(`${context.workspace}/${root}/${name}/SKILL.md`, "utf8")).slice(
              0,
              5e4
            );
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }
        throw new Error(`skill not found: ${name}`);
      }
    );
    prompts.register({
      id: "productivity",
      title: "Planning and durable state",
      priority: 20,
      content: "Use todo_write for temporary multi-step plans, task_graph tools for durable dependency-aware projects, skills only on demand, and memory_store/memory_search for stable non-secret facts. The legacy memory_read/memory_append/memory_replace aliases are deprecated and exist only during migration."
    });
  }
};

// ../src/features/orchestration.ts
import { AsyncLocalStorage as AsyncLocalStorage2 } from "node:async_hooks";
var def2 = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } }
});
var nested = new AsyncLocalStorage2();
var teamContext = new AsyncLocalStorage2();
var boards = /* @__PURE__ */ new Map();
var orchestration = {
  id: "orchestration",
  register({ tools, prompts, run }) {
    tools.register(
      def2("subagent", "Delegate one focused isolated task", { task: { type: "string" } }, ["task"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested delegation is disabled");
        const task = String(input.task ?? "").trim();
        if (!task) throw new Error("task is required");
        return await nested.run(true, () => run({
          query: `Complete only this focused task and return concise evidence.

${task}`,
          workspace: context.workspace,
          permissionMode: "ask",
          signal: context.signal,
          budget: context.budget.child({
            iterations: 12,
            toolCalls: 24,
            outputChars: 8e4,
            cost: 12
          })
        }));
      }
    );
    tools.register(
      def2("team_send", "Send a message inside an active team", {
        to: { type: "string" },
        kind: { type: "string" },
        content: { type: "string" }
      }, ["to", "kind", "content"]),
      async (input) => {
        const active2 = teamContext.getStore();
        if (!active2) throw new Error("team_send is only available inside a team");
        const message = {
          from: active2.member,
          to: String(input.to),
          kind: String(input.kind),
          content: String(input.content),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        boards.get(active2.id).push(message);
        return JSON.stringify(message);
      }
    );
    tools.register(
      def2("team_inbox", "Read messages for the active team member", {}, []),
      async () => {
        const active2 = teamContext.getStore();
        if (!active2) throw new Error("team_inbox is only available inside a team");
        return JSON.stringify(
          (boards.get(active2.id) ?? []).filter(
            (item) => item.to === "all" || item.to === active2.member || item.from === active2.member
          )
        );
      }
    );
    tools.register(
      def2("team_run", "Run 2 to 4 specialists in parallel", {
        objective: { type: "string" },
        members: { type: "array" }
      }, ["objective", "members"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested teams are disabled");
        if (!Array.isArray(input.members) || input.members.length < 2 || input.members.length > 4) {
          throw new Error("team requires 2 to 4 members");
        }
        const members = input.members;
        const id = `team-${crypto.randomUUID().slice(0, 8)}`, objective = String(input.objective ?? "");
        boards.set(id, []);
        const settled = await nested.run(
          true,
          () => Promise.allSettled(
            members.map(
              (raw) => teamContext.run(
                { id, member: String(raw.id) },
                () => run({
                  query: `You are ${raw.role}. Work only on: ${raw.task}
Shared objective: ${objective}
Broadcast important findings with team_send and read team_inbox before finalizing.`,
                  workspace: context.workspace,
                  permissionMode: "ask",
                  signal: context.signal,
                  budget: context.budget.child({
                    iterations: 8,
                    toolCalls: 16,
                    outputChars: 4e4,
                    cost: 8
                  })
                })
              )
            )
          )
        );
        return JSON.stringify({
          id,
          objective,
          messages: boards.get(id),
          members: members.map(
            (member, index) => settled[index].status === "fulfilled" ? {
              ...member,
              status: "completed",
              result: settled[index].value
            } : {
              ...member,
              status: "failed",
              result: String(settled[index].reason)
            }
          )
        });
      }
    );
    tools.register(
      def2("autonomous_run", "Run a bounded observe-act-verify loop", {
        objective: { type: "string" },
        success_criteria: { type: "array" },
        max_iterations: { type: "number" }
      }, ["objective", "success_criteria"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested autonomy is disabled");
        const max = Math.min(6, Math.max(1, Number(input.max_iterations ?? 4))), results = [];
        await nested.run(true, async () => {
          for (let iteration = 1; iteration <= max; iteration++) {
            const output4 = await run({
              query: `Autonomous iteration ${iteration}/${max}. Objective: ${input.objective}
Success criteria: ${JSON.stringify(input.success_criteria)}
Previous evidence: ${results.join("\n")}
Act, verify, then emit [AUTONOMY_COMPLETE] only when every criterion is proven.`,
              workspace: context.workspace,
              permissionMode: "ask",
              signal: context.signal,
              budget: context.budget.child({
                iterations: 8,
                toolCalls: 16,
                outputChars: 4e4,
                cost: 8
              })
            });
            results.push(output4);
            if (output4.includes("[AUTONOMY_COMPLETE]")) {
              break;
            }
          }
        });
        return JSON.stringify({
          status: results.at(-1)?.includes("[AUTONOMY_COMPLETE]") ? "completed" : "iteration_limit",
          iterations: results
        });
      }
    );
    prompts.register({
      id: "orchestration",
      title: "Delegation and autonomy",
      priority: 30,
      content: "Use direct tools first. Delegate only independent focused work. Teams have 2\u20134 non-overlapping members. Autonomy requires measurable success criteria and strict limits. Nested orchestration is disabled."
    });
  }
};

// ../src/features/integrations.ts
import { mkdir as mkdir3, readFile as readFile4 } from "node:fs/promises";

// ../src/mcp.ts
import { spawn as spawn2 } from "node:child_process";
var PROTOCOL_VERSION = "2025-03-26";
var MAX_MCP_RESPONSE_BYTES = 2e6;
var MAX_STDERR_BYTES = 8e3;
function assertSafeUrl(value2) {
  const parsed = new URL(value2);
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("MCP requires HTTPS or local HTTP");
  }
  return parsed;
}
function parseJsonRpcResponse(response, text4) {
  if (new TextEncoder().encode(text4).byteLength > MAX_MCP_RESPONSE_BYTES) {
    throw new Error("MCP response exceeds the 2 MB limit");
  }
  const isSse = response.headers.get("content-type")?.includes("text/event-stream");
  const json2 = isSse ? text4.split(/\r?\n/).filter((line) => line.startsWith("data:")).map(
    (line) => line.slice(5).trim()
  ).filter(Boolean).at(-1) : text4;
  const payload = JSON.parse(json2 || "{}");
  if (payload.error) throw new Error(payload.error.message || "MCP request failed");
  return payload.result;
}
var HttpMcpTransport = class {
  constructor(url) {
    this.url = url;
    assertSafeUrl(url);
  }
  async request(message, signal) {
    const parsed = assertSafeUrl(this.url);
    const response = await fetch(parsed, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...message }),
      signal
    });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    return parseJsonRpcResponse(response, await response.text());
  }
  async close() {
  }
};
var StdioMcpTransport = class {
  child;
  pending = /* @__PURE__ */ new Map();
  buffer = Buffer.alloc(0);
  closed = false;
  stderr = "";
  constructor(command, args = [], env2 = {}) {
    if (!command.trim()) throw new Error("MCP STDIO command is required");
    this.child = spawn2(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env2 }
    });
    this.child.stdout.on("data", (chunk) => this.consume(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-MAX_STDERR_BYTES);
    });
    this.child.once("error", (error) => this.failPending(error));
    this.child.once("close", (code, signal) => {
      this.closed = true;
      this.failPending(new Error(`MCP STDIO closed (${code ?? signal ?? "unknown"})`));
    });
  }
  request(message, signal) {
    if (this.closed || !this.child.stdin.writable) {
      return Promise.reject(new Error("MCP STDIO transport is closed"));
    }
    if (signal?.aborted) {
      return Promise.reject(new DOMException("MCP request cancelled", "AbortError"));
    }
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...message }), "utf8");
    const frame = Buffer.from(`Content-Length: ${body.byteLength}\r
\r
`, "utf8");
    return new Promise((resolve4, reject) => {
      const pending = { resolve: resolve4, reject, signal };
      const onAbort = () => {
        this.pending.delete(message.id);
        reject(new DOMException("MCP request cancelled", "AbortError"));
      };
      pending.onAbort = onAbort;
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(message.id, pending);
      this.child.stdin.write(Buffer.concat([frame, body]), (error) => {
        if (!error) return;
        this.pending.delete(message.id);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
    });
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.failPending(new Error("MCP STDIO transport closed"));
    this.child.kill();
  }
  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("utf8");
      const length = Number(header.match(/content-length:\s*(\d+)/i)?.[1]);
      if (!Number.isInteger(length) || length < 0 || length > MAX_MCP_RESPONSE_BYTES) {
        this.failPending(new Error("Invalid MCP STDIO Content-Length"));
        return;
      }
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + length);
      try {
        const payload = JSON.parse(body);
        if (!payload.id) continue;
        const pending = this.pending.get(payload.id);
        if (!pending) continue;
        this.pending.delete(payload.id);
        pending.signal?.removeEventListener("abort", pending.onAbort);
        if (payload.error) pending.reject(new Error(payload.error.message || "MCP request failed"));
        else pending.resolve(payload.result);
      } catch (error) {
        this.failPending(error);
        return;
      }
    }
  }
  failPending(error) {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.signal?.removeEventListener("abort", pending.onAbort);
      pending.reject(this.stderr ? new Error(`${String(error)}: ${this.stderr}`) : error);
    }
  }
};
async function createTransport(config) {
  const kind2 = config.transport ?? (config.command ? "stdio" : "http");
  if (kind2 === "stdio") return new StdioMcpTransport(config.command ?? "", config.args, config.env);
  if (!config.url) throw new Error("MCP server url is required");
  return new HttpMcpTransport(config.url);
}
function fingerprint(config) {
  return JSON.stringify({
    name: config.name,
    transport: config.transport,
    url: config.url,
    command: config.command,
    args: config.args,
    env: config.env
  });
}
var McpSessionManager = class {
  constructor(factory = createTransport) {
    this.factory = factory;
  }
  sessions = /* @__PURE__ */ new Map();
  initializing = /* @__PURE__ */ new Map();
  async call(workspace, config, method, params, signal) {
    const key5 = `${workspace}\0${config.name}`;
    const currentFingerprint = fingerprint(config);
    let session = this.sessions.get(key5);
    if (session && session.configFingerprint !== currentFingerprint) {
      await session.transport.close();
      this.sessions.delete(key5);
      session = void 0;
    }
    if (!session) {
      let pending = this.initializing.get(key5);
      if (!pending) {
        pending = this.createSession(key5, config, currentFingerprint, signal);
        this.initializing.set(key5, pending);
        void pending.then(
          () => this.initializing.delete(key5),
          () => this.initializing.delete(key5)
        );
      }
      session = await pending;
    }
    return await session.transport.request({ id: crypto.randomUUID(), method, params }, signal);
  }
  async createSession(key5, config, configFingerprint, signal) {
    const transport = await this.factory(config);
    const status = {
      key: key5,
      server: config.name,
      transport: config.transport ?? (config.command ? "stdio" : "http"),
      initialized: false,
      capabilities: void 0
    };
    const session = { key: key5, configFingerprint, transport, status };
    try {
      status.capabilities = await transport.request({
        id: crypto.randomUUID(),
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "AI Agent", version: "1.0" }
        }
      }, signal);
      status.initialized = true;
      this.sessions.set(key5, session);
      return session;
    } catch (error) {
      await transport.close();
      throw error;
    }
  }
  status(workspace, server) {
    return [...this.sessions.values()].filter(
      (session) => session.key.startsWith(`${workspace}\0`) && (!server || session.status.server === server)
    ).map((session) => ({ ...session.status }));
  }
  async shutdown() {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.transport.close()));
  }
};
var mcpSessionManager = new McpSessionManager();
async function shutdownMcpSessions() {
  await mcpSessionManager.shutdown();
}

// ../src/features/integrations.ts
var def3 = (name, description, properties, required = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } }
});
var jobs = /* @__PURE__ */ new Map();
var worktrees = /* @__PURE__ */ new Map();
async function git(cwd, args) {
  const result = await runCommand(isWindows ? "git.exe" : "git", args, { cwd });
  const text4 = result.stdout + result.stderr;
  if (!result.success) throw new Error(text4);
  return text4.trim();
}
function asMcpServer(value2) {
  if (!value2 || typeof value2 !== "object") return void 0;
  const item = value2;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name || name.length > 120) return void 0;
  const transport = item.transport === "sse" || item.transport === "stdio" || item.transport === "http" ? item.transport : void 0;
  const args = Array.isArray(item.args) ? item.args.filter((arg) => typeof arg === "string").slice(0, 32) : void 0;
  const env2 = item.env && typeof item.env === "object" ? Object.fromEntries(
    Object.entries(item.env).filter(
      ([key5, value3]) => /^[A-Za-z_][A-Za-z0-9_]{0,80}$/.test(key5) && typeof value3 === "string"
    ).slice(0, 64)
  ) : void 0;
  return {
    name,
    enabled: item.enabled !== false,
    transport,
    url: typeof item.url === "string" ? item.url : void 0,
    command: typeof item.command === "string" ? item.command : void 0,
    args,
    env: env2
  };
}
async function mcpServers(workspace) {
  for (const path2 of [`${workspace}/.ai-agent/mcp.json`, `${workspace}/mcp.json`]) {
    try {
      const parsed = JSON.parse(await readFile4(path2, "utf8"));
      return Array.isArray(parsed.servers) ? parsed.servers.map(asMcpServer).filter((item) => Boolean(item)) : [];
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return [];
}
function publicMcpServer(server) {
  return {
    name: server.name,
    enabled: server.enabled !== false,
    transport: server.transport ?? (server.command ? "stdio" : "http"),
    url: server.url,
    command: server.command,
    args: server.args
  };
}
var integrations = {
  id: "integrations",
  register({ tools, prompts, run }) {
    tools.register(
      def3("background_start", "Start a supervised background command", {
        command: { type: "string" }
      }, ["command"]),
      async (input, context) => {
        if ([...jobs.values()].filter((job2) => job2.status === "running").length >= 4) {
          throw new Error("at most 4 background tasks may run");
        }
        const command = String(input.command), shell = isWindows ? "cmd.exe" : "/bin/sh", process2 = spawnCommand(shell, isWindows ? ["/d", "/s", "/c", command] : ["-c", command], {
          cwd: context.workspace
        }), job = {
          id: `bg-${crypto.randomUUID().slice(0, 8)}`,
          workspace: context.workspace,
          command,
          status: "running",
          output: "",
          process: process2
        };
        jobs.set(job.id, job);
        const output4 = [], errors = [];
        process2.stdout?.on("data", (chunk) => output4.push(chunk));
        process2.stderr?.on("data", (chunk) => errors.push(chunk));
        process2.once("close", (code) => {
          job.output = Buffer.concat([...output4, ...errors]).toString("utf8").slice(0, 5e4);
          job.status = code === 0 ? "completed" : "failed";
        });
        return JSON.stringify({ id: job.id, status: job.status, command });
      }
    );
    tools.register(
      def3("background_status", "Get background task status", { id: { type: "string" } }),
      async (input, context) => JSON.stringify(
        [...jobs.values()].filter(
          (job) => job.workspace === context.workspace && (!input.id || job.id === input.id)
        ).map(({ process: _, ...job }) => job)
      )
    );
    tools.register(
      def3("background_cancel", "Cancel a background task", { id: { type: "string" } }, ["id"]),
      async (input) => {
        const job = jobs.get(String(input.id));
        if (!job) throw new Error("background task not found");
        if (job.status === "running") {
          job.process.kill("SIGTERM");
          job.status = "cancelled";
        }
        return JSON.stringify({ id: job.id, status: job.status });
      }
    );
    tools.register(
      def3("worktree_create", "Create an isolated Git worktree", { id: { type: "string" } }, ["id"]),
      async (input, context) => {
        const id = String(input.id), root = await git(context.workspace, ["rev-parse", "--show-toplevel"]), path2 = `${root}/.ai-agent-worktrees/${id}`, branch = `ai-agent/${id}`;
        await mkdir3(`${root}/.ai-agent-worktrees`, { recursive: true });
        await git(root, ["worktree", "add", "-b", branch, path2, "HEAD"]);
        const record = { id, root, path: path2, branch };
        worktrees.set(id, record);
        return JSON.stringify(record);
      }
    );
    tools.register(
      def3("worktree_list", "List managed Git worktrees", {}),
      async () => JSON.stringify([...worktrees.values()])
    );
    tools.register(
      def3("worktree_agent", "Run a task inside an isolated worktree", {
        id: { type: "string" },
        task: { type: "string" }
      }, ["id", "task"]),
      async (input, context) => {
        const item = worktrees.get(String(input.id));
        if (!item) throw new Error("worktree not found");
        return await run({
          query: String(input.task),
          workspace: item.path,
          permissionMode: "ask",
          signal: context.signal,
          budget: context.budget.child({
            iterations: 16,
            toolCalls: 32,
            outputChars: 1e5,
            cost: 16
          })
        });
      }
    );
    tools.register(
      def3("worktree_remove", "Remove a clean worktree", { id: { type: "string" } }, ["id"]),
      async (input) => {
        const item = worktrees.get(String(input.id));
        if (!item) {
          throw new Error("worktree not found");
        }
        if (await git(item.path, ["status", "--porcelain"])) {
          throw new Error("worktree has uncommitted changes");
        }
        await git(item.root, ["worktree", "remove", item.path]);
        worktrees.delete(item.id);
        return "Worktree removed";
      }
    );
    tools.register(
      def3("mcp_servers", "List workspace MCP servers", {}),
      async (_input, context) => JSON.stringify((await mcpServers(context.workspace)).map(publicMcpServer))
    );
    tools.register(
      def3("mcp_list_tools", "List tools from an MCP server", { server: { type: "string" } }, [
        "server"
      ]),
      async (input, context) => {
        const server = (await mcpServers(context.workspace)).find(
          (item) => item.name === input.server && item.enabled !== false
        );
        if (!server) throw new Error("MCP server not found");
        return JSON.stringify(
          await mcpSessionManager.call(context.workspace, server, "tools/list", {}, context.signal)
        );
      }
    );
    tools.register(
      def3("mcp_call", "Call an MCP tool", {
        server: { type: "string" },
        tool: { type: "string" },
        arguments: { type: "object" }
      }, ["server", "tool", "arguments"]),
      async (input, context) => {
        const server = (await mcpServers(context.workspace)).find(
          (item) => item.name === input.server && item.enabled !== false
        );
        if (!server) throw new Error("MCP server not found");
        return JSON.stringify(
          await mcpSessionManager.call(
            context.workspace,
            server,
            "tools/call",
            { name: input.tool, arguments: input.arguments },
            context.signal
          )
        );
      }
    );
    tools.register(
      def3("mcp_status", "Read negotiated MCP sessions for the current workspace", {
        server: { type: "string" }
      }),
      async (input, context) => JSON.stringify(
        mcpSessionManager.status(
          context.workspace,
          typeof input.server === "string" ? input.server : void 0
        )
      )
    );
    prompts.register({
      id: "integrations",
      title: "Background, isolation, and plugins",
      priority: 40,
      content: "Use background tasks for long commands, worktrees for isolated changes, and MCP only after discovering the relevant server and tool. MCP calls reuse an initialized, negotiated Session over a bounded HTTP, SSE, or STDIO Transport; preserve AbortSignal cancellation, HTTPS/local-host policy, bounded output, and clean shutdown. Never bypass permissions or remove dirty worktrees."
    });
  }
};

// ../src/features/diagnostics.ts
var diagnostics = {
  id: "diagnostics",
  register({ tools, prompts }) {
    tools.register({
      type: "function",
      function: {
        name: "harness_status",
        description: "Return formal harness capabilities",
        parameters: { type: "object", properties: {} }
      }
    }, async (_input, context) => JSON.stringify({
      version: "1.0.0",
      workspace: context.workspace,
      runtime: platformVersion(),
      capabilities: [
        "tools",
        "permissions",
        "hooks",
        "todo",
        "subagent",
        "skills",
        "compaction",
        "memory",
        "recovery",
        "task-graph",
        "background",
        "scheduling",
        "teams",
        "protocol",
        "autonomy",
        "bounded-runtime",
        "worktree",
        "mcp",
        "a2a-handoff",
        "rag-memory",
        "grounded-research",
        "evaluation-ci",
        "security-boundary",
        "desktop"
      ]
    }));
    prompts.register({
      id: "contract",
      title: "Complete harness contract",
      priority: 1,
      content: "Select the smallest sufficient capability, keep actions observable, protect secrets, preserve durable state intentionally, and never claim success when verification fails."
    });
  }
};

// ../src/config/conversations.ts
var MAX_SESSIONS = 100;
var MAX_MESSAGES_PER_SESSION = 500;
var MAX_CONTENT_LENGTH = 1e5;
async function conversationsPath(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const id = [...new Uint8Array(digest)].slice(0, 12).map(
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  return `${appDataDir()}/conversations/${id}.json`;
}
function validateSessions(value2) {
  if (!Array.isArray(value2)) throw new Error("sessions must be an array");
  if (value2.length > MAX_SESSIONS) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_SESSIONS} \u4E2A\u5BF9\u8BDD`);
  return value2.map((raw, sessionIndex) => {
    if (!raw || typeof raw !== "object") throw new Error(`sessions[${sessionIndex}] \u65E0\u6548`);
    const session = raw;
    const id = String(session.id ?? ""), title = String(session.title ?? "").trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new Error(`sessions[${sessionIndex}].id \u65E0\u6548`);
    if (!title || title.length > 200) throw new Error(`sessions[${sessionIndex}].title \u65E0\u6548`);
    if (!Array.isArray(session.messages) || session.messages.length > MAX_MESSAGES_PER_SESSION) {
      throw new Error(`sessions[${sessionIndex}].messages \u65E0\u6548`);
    }
    const messages = session.messages.map((rawMessage, messageIndex) => {
      if (!rawMessage || typeof rawMessage !== "object") {
        throw new Error(`sessions[${sessionIndex}].messages[${messageIndex}] \u65E0\u6548`);
      }
      const message = rawMessage;
      const role = String(message.role ?? "");
      const content = String(message.content ?? "");
      if (role !== "user" && role !== "assistant") throw new Error("\u6D88\u606F\u89D2\u8272\u65E0\u6548");
      if (content.length > MAX_CONTENT_LENGTH) throw new Error("\u5355\u6761\u6D88\u606F\u5185\u5BB9\u8FC7\u957F");
      return { role, content };
    });
    const createdAt = Number(session.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) throw new Error("\u5BF9\u8BDD\u65F6\u95F4\u65E0\u6548");
    return { id, title, messages, createdAt };
  });
}
async function readConversations(workspace) {
  const path2 = await conversationsPath(workspace ?? await getWorkspace());
  try {
    return validateSessions(JSON.parse(await readUtf8(path2)));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveConversations(value2, workspace) {
  const sessions = validateSessions(value2);
  const path2 = await conversationsPath(workspace ?? await getWorkspace());
  await writeJsonAtomic(path2, sessions);
  return sessions;
}
async function appendConversation(workspace, session) {
  const sessions = await readConversations(workspace);
  await saveConversations(
    [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, MAX_SESSIONS),
    workspace
  );
}

// ../src/scheduler.ts
import { stat as stat2 } from "node:fs/promises";
var runner;
var loaded = false;
var timers = /* @__PURE__ */ new Map();
var running = /* @__PURE__ */ new Set();
function configureScheduler(value2) {
  runner = value2;
}
function path() {
  return `${appDataDir()}/cron/agent-schedules.json`;
}
function validate(value2) {
  if (!Array.isArray(value2) || value2.length > 50) throw new Error("\u5B9A\u65F6\u4EFB\u52A1\u5FC5\u987B\u662F\u6700\u591A 50 \u9879\u7684\u6570\u7EC4");
  const ids = /* @__PURE__ */ new Set();
  return value2.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`schedules[${index}] \u65E0\u6548`);
    const item = raw;
    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim();
    const prompt = String(item.prompt ?? "").trim();
    const frequency = String(item.frequency ?? "interval");
    const intervalSeconds = Math.floor(Number(item.intervalSeconds ?? 60));
    const timeoutSeconds = Math.floor(Number(item.timeoutSeconds ?? 600));
    const permissionMode = String(item.permissionMode ?? "auto");
    const time = String(item.time ?? "09:00");
    const weekday = Math.floor(Number(item.weekday ?? 1));
    const dayOfMonth = Math.floor(Number(item.dayOfMonth ?? 1));
    const month = Math.floor(Number(item.month ?? 1));
    if (!/^[\w.-]{1,80}$/.test(id) || ids.has(id)) {
      throw new Error(`schedules[${index}].id \u65E0\u6548\u6216\u91CD\u590D`);
    }
    ids.add(id);
    if (!title || !prompt || title.length > 200 || prompt.length > 5e4) {
      throw new Error(`schedules[${index}] \u6807\u9898\u6216\u63D0\u793A\u8BCD\u65E0\u6548`);
    }
    if (!["interval", "daily", "weekly", "monthly", "yearly"].includes(frequency)) {
      throw new Error("\u6267\u884C\u9891\u7387\u65E0\u6548");
    }
    if (frequency === "interval" && (intervalSeconds < 5 || intervalSeconds > 2592e3)) {
      throw new Error("\u95F4\u9694\u5FC5\u987B\u4E3A 5\u20132592000 \u79D2");
    }
    if (frequency !== "interval" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("\u65F6\u95F4\u5FC5\u987B\u4F7F\u7528 HH:mm");
    }
    if (frequency === "weekly" && (weekday < 0 || weekday > 6)) throw new Error("\u661F\u671F\u5FC5\u987B\u4E3A 0\u20136");
    if (["monthly", "yearly"].includes(frequency) && (dayOfMonth < 1 || dayOfMonth > 31)) {
      throw new Error("\u65E5\u671F\u5FC5\u987B\u4E3A 1\u201331");
    }
    if (frequency === "yearly" && (month < 1 || month > 12)) throw new Error("\u6708\u4EFD\u5FC5\u987B\u4E3A 1\u201312");
    if (timeoutSeconds < 10 || timeoutSeconds > 7200) throw new Error("\u8D85\u65F6\u5FC5\u987B\u4E3A 10\u20137200 \u79D2");
    if (!["ask", "auto", "full"].includes(permissionMode)) throw new Error("\u6743\u9650\u6A21\u5F0F\u65E0\u6548");
    return {
      id,
      title,
      prompt,
      frequency,
      intervalSeconds,
      timeoutSeconds,
      permissionMode,
      workspace: item.workspace === null || item.workspace === "global" ? null : String(item.workspace ?? "").trim() || null,
      providerId: typeof item.providerId === "string" && item.providerId ? item.providerId : void 0,
      time: frequency === "interval" ? void 0 : time,
      weekday: frequency === "weekly" ? weekday : void 0,
      dayOfMonth: ["monthly", "yearly"].includes(frequency) ? dayOfMonth : void 0,
      month: frequency === "yearly" ? month : void 0,
      model: typeof item.model === "string" && item.model ? item.model : void 0,
      enabled: item.enabled !== false,
      lastRunAt: typeof item.lastRunAt === "string" ? item.lastRunAt : void 0,
      lastConversationId: typeof item.lastConversationId === "string" ? item.lastConversationId : void 0,
      lastError: typeof item.lastError === "string" ? item.lastError : void 0
    };
  });
}
async function read() {
  try {
    return validate(JSON.parse(await readUtf8(path())));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function persist(schedules) {
  const target = path();
  await writeJsonAtomic(target, schedules);
}
function calendar(year, month, day, hour, minute) {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), hour, minute);
}
function nextRun(schedule, from = /* @__PURE__ */ new Date()) {
  if (schedule.frequency === "interval") {
    return new Date(from.getTime() + schedule.intervalSeconds * 1e3);
  }
  const [hour, minute] = (schedule.time ?? "09:00").split(":").map(Number);
  if (schedule.frequency === "daily") {
    const next2 = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    if (next2 <= from) next2.setDate(next2.getDate() + 1);
    return next2;
  }
  if (schedule.frequency === "weekly") {
    const next2 = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    let days = ((schedule.weekday ?? 1) - next2.getDay() + 7) % 7;
    if (!days && next2 <= from) days = 7;
    next2.setDate(next2.getDate() + days);
    return next2;
  }
  if (schedule.frequency === "monthly") {
    let next2 = calendar(
      from.getFullYear(),
      from.getMonth(),
      schedule.dayOfMonth ?? 1,
      hour,
      minute
    );
    if (next2 <= from) {
      next2 = calendar(
        from.getFullYear(),
        from.getMonth() + 1,
        schedule.dayOfMonth ?? 1,
        hour,
        minute
      );
    }
    return next2;
  }
  let next = calendar(
    from.getFullYear(),
    (schedule.month ?? 1) - 1,
    schedule.dayOfMonth ?? 1,
    hour,
    minute
  );
  if (next <= from) {
    next = calendar(
      from.getFullYear() + 1,
      (schedule.month ?? 1) - 1,
      schedule.dayOfMonth ?? 1,
      hour,
      minute
    );
  }
  return next;
}
async function execute(id) {
  if (!runner) throw new Error("Harness scheduler \u5C1A\u672A\u521D\u59CB\u5316");
  if (running.has(id)) throw new Error(`\u4EFB\u52A1\u6B63\u5728\u6267\u884C\uFF1A${id}`);
  const schedules = await read();
  const schedule = schedules.find((item) => item.id === id);
  if (!schedule) throw new Error(`\u5B9A\u65F6\u4EFB\u52A1\u4E0D\u5B58\u5728\uFF1A${id}`);
  const workspace = schedule.workspace ?? await getWorkspace();
  const conversationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), schedule.timeoutSeconds * 1e3);
  running.add(id);
  let answer = "";
  try {
    answer = await runner({
      query: schedule.prompt,
      workspace,
      providerId: schedule.providerId,
      model: schedule.model,
      permissionMode: schedule.permissionMode,
      signal: controller.signal
    });
    schedule.lastError = void 0;
  } catch (error) {
    answer = `\u5B9A\u65F6\u4EFB\u52A1\u6267\u884C\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`;
    schedule.lastError = answer;
  } finally {
    clearTimeout(timeout);
    running.delete(id);
  }
  schedule.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  schedule.lastConversationId = conversationId;
  await persist(schedules);
  await appendConversation(workspace, {
    id: conversationId,
    title: `\u25F7 ${schedule.title}`,
    createdAt: Date.now(),
    messages: [{ role: "user", content: schedule.prompt }, { role: "assistant", content: answer }]
  });
  return { schedule, conversationId, workspace, answer };
}
function install(schedules) {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (let schedule of schedules.filter((item) => item.enabled)) {
    const arm = () => timers.set(
      schedule.id,
      setTimeout(async () => {
        try {
          await execute(schedule.id);
        } catch (error) {
          console.error(`[cron:${schedule.id}]`, error);
        }
        const latest = (await read()).find((item) => item.id === schedule.id);
        if (latest?.enabled) {
          schedule = latest;
          arm();
        }
      }, Math.max(1e3, nextRun(schedule).getTime() - Date.now()))
    );
    arm();
  }
  loaded = true;
}
async function ensure() {
  if (!loaded) install(await read());
}
async function listCronSchedules() {
  await ensure();
  return (await read()).map((item) => ({
    ...item,
    nextRunAt: item.enabled ? nextRun(item).toISOString() : void 0
  }));
}
async function saveCronSchedules(value2) {
  const schedules = validate(value2);
  for (const item of schedules) {
    if (item.workspace && !(await stat2(item.workspace)).isDirectory()) {
      throw new Error(`\u7ED1\u5B9A\u9879\u76EE\u5DF2\u5931\u6548\uFF1A${item.workspace}`);
    }
  }
  await persist(schedules);
  install(schedules);
  return await listCronSchedules();
}
async function runCronSchedule(id) {
  await ensure();
  return await execute(id);
}

// ../src/features/scheduling.ts
function definition2(name, description, properties, required = []) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
var scheduling = {
  id: "scheduling",
  register({ tools, prompts, run }) {
    configureScheduler(run);
    tools.register(
      definition2("cron_list", "List recurring AI conversation tasks", {}),
      async () => JSON.stringify(await listCronSchedules())
    );
    tools.register(
      definition2("cron_write", "Replace recurring AI conversation tasks", {
        schedules: { type: "array" }
      }, ["schedules"]),
      async (input) => JSON.stringify(await saveCronSchedules(input.schedules))
    );
    tools.register(
      definition2("cron_run_now", "Run one recurring AI conversation task immediately", {
        id: { type: "string" }
      }, ["id"]),
      async (input) => JSON.stringify(await runCronSchedule(String(input.id ?? "")))
    );
    prompts.register({
      id: "scheduling",
      title: "Scheduled conversations",
      priority: 47,
      content: "Recurring tasks send an AI prompt and save the answer as a conversation in their bound project. A null workspace uses the default project. Modify schedules only when explicitly requested."
    });
  }
};

// ../src/features/runtime_limits.ts
var runtimeLimits = {
  id: "runtime-limits",
  register({ prompts }) {
    prompts.register({
      id: "runtime-budget",
      title: "Executable runtime budgets",
      priority: 5,
      content: "Every run has executable iteration, tool-call, output, cost, and cancellation budgets. Treat budget errors as terminal runtime states; do not retry by silently bypassing a limit. Nested agents must use smaller child budgets."
    });
  }
};

// ../src/features/pdf_reader.ts
import { inflateSync } from "node:zlib";
import { readFile as readFile5, stat as stat3 } from "node:fs/promises";
import { isAbsolute as isAbsolute2, relative as relative2, resolve as resolve2 } from "node:path";
var MAX_PDF_BYTES = 50 * 1024 * 1024;
var MAX_OUTPUT_CHARS = 2e5;
var definition3 = (name, description, properties, required) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } }
});
function safePath2(workspace, requested) {
  const root = resolve2(workspace);
  const path2 = resolve2(root, requested);
  const rel = relative2(root, path2);
  if (rel === ".." || rel.startsWith(`..\\`) || rel.startsWith(`../`) || isAbsolute2(rel)) {
    throw new Error(`Path escapes workspace: ${requested}`);
  }
  return path2;
}
function decodeBytes(bytes) {
  if (bytes.length >= 2 && bytes[0] === 254 && bytes[1] === 255) {
    const littleEndian = new Uint8Array(bytes.length - 2);
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      littleEndian[index - 2] = bytes[index + 1];
      littleEndian[index - 1] = bytes[index];
    }
    return Buffer.from(littleEndian).toString("utf16le");
  }
  const buffer = Buffer.from(bytes);
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}
function readLiteral(source, start) {
  let index = start + 1;
  let depth = 1;
  const bytes = [];
  while (index < source.length && depth > 0) {
    const char = source[index++];
    if (char === "\\") {
      if (index >= source.length) break;
      const escaped = source[index++];
      const escapes = {
        n: 10,
        r: 13,
        t: 9,
        b: 8,
        f: 12
      };
      if (escapes[escaped] !== void 0) {
        bytes.push(escapes[escaped]);
      } else if (/[0-7]/.test(escaped)) {
        let octal = escaped;
        while (octal.length < 3 && index < source.length && /[0-7]/.test(source[index])) {
          octal += source[index++];
        }
        bytes.push(parseInt(octal, 8));
      } else if (escaped !== "\r" && escaped !== "\n") {
        bytes.push(escaped.charCodeAt(0));
      }
      continue;
    }
    if (char === "(") {
      depth++;
      bytes.push(char.charCodeAt(0));
    } else if (char === ")") {
      depth--;
      if (depth > 0) bytes.push(char.charCodeAt(0));
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return { value: decodeBytes(Uint8Array.from(bytes)), next: index };
}
function readHex(source, start) {
  const end = source.indexOf(">", start + 1);
  if (end < 0) return { value: "", next: source.length };
  const hex = source.slice(start + 1, end).replace(/\s/g, "");
  const normalized = hex.length % 2 === 0 ? hex : `${hex}0`;
  return { value: decodeBytes(Buffer.from(normalized, "hex")), next: end + 1 };
}
function tokenize(source, start = 0, stopAtArrayEnd = false) {
  const tokens2 = [];
  let index = start;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] === "%") {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd < 0 ? source.length : lineEnd + 1;
      continue;
    }
    if (source[index] === "]") {
      return { tokens: tokens2, next: stopAtArrayEnd ? index + 1 : index };
    }
    if (source[index] === "[") {
      const array = tokenize(source, index + 1, true);
      tokens2.push(array.tokens);
      index = array.next;
      continue;
    }
    if (source[index] === "(") {
      const literal = readLiteral(source, index);
      tokens2.push({ kind: "text", value: literal.value });
      index = literal.next;
      continue;
    }
    if (source[index] === "<" && source[index + 1] !== "<") {
      const hex = readHex(source, index);
      tokens2.push({ kind: "text", value: hex.value });
      index = hex.next;
      continue;
    }
    const tokenStart = index;
    while (index < source.length && !/[\s()[\]<>%]/.test(source[index])) index++;
    if (tokenStart === index) {
      index++;
      continue;
    }
    tokens2.push(source.slice(tokenStart, index));
  }
  return { tokens: tokens2, next: index };
}
function textFromTokens(tokens2) {
  const output4 = [];
  const textValue = (token) => {
    if (typeof token === "object" && !Array.isArray(token)) return token.value;
    if (Array.isArray(token)) return token.map(textValue).join("");
    return "";
  };
  for (let index = 0; index < tokens2.length; index++) {
    const token = tokens2[index];
    if (token === "Tj" || token === "TJ" || token === "'" || token === '"') {
      const value2 = textValue(tokens2[index - 1] ?? "");
      if (value2) output4.push(value2);
      if (token === "'" || token === '"') output4.push("\n");
    } else if (token === "T*" || token === "Td" || token === "TD") {
      if (output4.length && !output4[output4.length - 1].endsWith("\n")) output4.push("\n");
    }
  }
  return output4.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extractInfo(source) {
  const info = {};
  for (const key5 of ["Title", "Author", "Subject", "Creator", "Producer", "CreationDate"]) {
    const marker = source.indexOf(`/${key5}`);
    if (marker < 0) continue;
    let index = marker + key5.length + 1;
    while (/\s/.test(source[index] ?? "")) index++;
    if (source[index] === "(") info[key5] = readLiteral(source, index).value;
    else if (source[index] === "<" && source[index + 1] !== "<") info[key5] = readHex(source, index).value;
  }
  return info;
}
function extractPdf(sourceBytes) {
  const source = Buffer.from(sourceBytes).toString("latin1");
  const streams = [];
  const streamPattern = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const dictionary = match[1] ?? "";
    const raw = Buffer.from(match[2] ?? "", "latin1");
    let decoded = raw;
    if (/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(dictionary)) {
      try {
        decoded = inflateSync(raw);
      } catch {
        continue;
      }
    } else if (/\/Filter\b/.test(dictionary)) {
      continue;
    }
    streams.push(Buffer.from(decoded).toString("latin1"));
  }
  const text4 = streams.map((stream) => textFromTokens(tokenize(stream).tokens)).filter(Boolean).join("\n\n");
  const pages = (source.match(/\/Type\s*\/Page\b/g) ?? []).length;
  return { pages, text: text4, metadata: extractInfo(source) };
}
function limitText(text4, maxChars) {
  if (text4.length <= maxChars) return { text: text4, truncated: false };
  return { text: `${text4.slice(0, maxChars)}

[output truncated]`, truncated: true };
}
var pdfReader = {
  id: "pdf-reader",
  register({ tools, prompts }) {
    tools.register(
      definition3(
        "read_pdf",
        "Read text and metadata from a PDF file inside the active workspace. Scanned PDFs may require OCR.",
        {
          path: { type: "string", description: "PDF path relative to the active workspace" },
          max_chars: { type: "number", description: "Maximum returned text length, capped at 200000" },
          include_metadata: { type: "boolean", description: "Whether to include PDF metadata" }
        },
        ["path"]
      ),
      async (input, context) => {
        const requested = String(input.path ?? "").trim();
        if (!requested.toLowerCase().endsWith(".pdf")) throw new Error("read_pdf requires a .pdf file");
        const path2 = safePath2(context.workspace, requested);
        const file = await stat3(path2);
        if (!file.isFile()) throw new Error(`PDF path is not a file: ${requested}`);
        if (file.size > MAX_PDF_BYTES) {
          throw new Error(`PDF is too large (${file.size} bytes; maximum is ${MAX_PDF_BYTES} bytes)`);
        }
        if (context.signal?.aborted) throw new DOMException("PDF read stopped", "AbortError");
        const parsed = extractPdf(await readFile5(path2, context.signal ? { signal: context.signal } : void 0));
        const maxChars = Math.min(
          MAX_OUTPUT_CHARS,
          Math.max(1e3, Number.isFinite(Number(input.max_chars)) ? Number(input.max_chars) : 1e5)
        );
        const limited = limitText(parsed.text, maxChars);
        const result = {
          path: requested,
          pages: parsed.pages,
          text: limited.text,
          truncated: limited.truncated,
          warning: parsed.text ? void 0 : "No extractable page text found. The PDF may be scanned, use embedded fonts, or store content only in metadata; OCR may be required."
        };
        if (input.include_metadata !== false) result.metadata = parsed.metadata;
        return JSON.stringify(result);
      }
    );
    prompts.register({
      id: "pdf-reader",
      title: "PDF reading",
      priority: 25,
      content: "Use read_pdf for workspace PDFs before making claims about their contents. Quote or summarize only extracted text and metadata, and disclose when OCR or visual inspection may be needed."
    });
  }
};

// ../src/features/image_generation.ts
import { mkdir as mkdir4 } from "node:fs/promises";
import { join } from "node:path";

// ../src/providers/seedream.ts
import { Buffer as Buffer3 } from "node:buffer";
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return { extension: "png", contentType: "image/png" };
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { extension: "webp", contentType: "image/webp" };
  throw new Error("\u56FE\u7247\u751F\u6210\u670D\u52A1\u8FD4\u56DE\u4E86\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F");
}
async function generateSeedreamImages(config, request, signal, fetcher = fetch) {
  const response = await fetcher(`${config.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      prompt: request.prompt,
      size: request.size,
      response_format: "b64_json",
      sequential_image_generation: "disabled",
      watermark: request.watermark
    }),
    signal
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2e3);
    throw new Error(`\u706B\u5C71\u65B9\u821F\u56FE\u7247\u751F\u6210\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF1A${detail}`);
  }
  const payload = await response.json();
  const encoded = payload.data?.map((item) => item.b64_json).filter((item) => Boolean(item)) ?? [];
  if (!encoded.length) throw new Error("\u706B\u5C71\u65B9\u821F\u6CA1\u6709\u8FD4\u56DE\u56FE\u7247\u6570\u636E");
  if (encoded.length !== 1) throw new Error("\u706B\u5C71\u65B9\u821F\u8FD4\u56DE\u4E86\u975E\u9884\u671F\u6570\u91CF\u7684\u56FE\u7247");
  return encoded.map((value2) => {
    const bytes = Buffer3.from(value2, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`\u751F\u6210\u56FE\u7247\u5927\u5C0F\u65E0\u6548\uFF08\u6700\u5927 ${MAX_IMAGE_BYTES / 1024 / 1024} MB\uFF09`);
    }
    return { bytes, ...imageType(bytes) };
  });
}

// ../src/features/image_generation.ts
var definition4 = {
  type: "function",
  function: {
    name: "generate_image",
    description: "Generate one image with Volcengine Ark Seedream and save it in the workspace",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed image prompt, preferably in Chinese" },
        size: { type: "string", enum: ["1K", "2K", "4K"], default: "2K" },
        watermark: {
          type: "boolean",
          default: true,
          description: "Whether the generated image includes the provider watermark"
        }
      },
      required: ["prompt"]
    }
  }
};
var imageGeneration = {
  id: "image-generation",
  register({ tools, prompts }) {
    tools.register(definition4, async (input, context) => {
      const prompt = String(input.prompt ?? "").trim();
      if (!prompt || prompt.length > 4e3) throw new Error("\u56FE\u7247\u63D0\u793A\u8BCD\u957F\u5EA6\u5FC5\u987B\u4E3A 1\u20134000 \u5B57\u7B26");
      const size = String(input.size ?? "2K");
      if (!["1K", "2K", "4K"].includes(size)) throw new Error("\u56FE\u7247\u5C3A\u5BF8\u4EC5\u652F\u6301 1K\u30012K \u6216 4K");
      const config = await resolveImageGenerationConfig();
      context.budget.consume("cost");
      const images = await generateSeedreamImages(config, {
        prompt,
        size,
        watermark: input.watermark !== false
      }, context.signal);
      const directory = join(context.workspace, ".ai-agent", "generated-images");
      await mkdir4(directory, { recursive: true });
      const results = [];
      for (const [index, image] of images.entries()) {
        const name = `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}${images.length > 1 ? `-${index + 1}` : ""}.${image.extension}`;
        const relativePath = `.ai-agent/generated-images/${name}`;
        await writeBufferAtomic(join(context.workspace, relativePath), image.bytes);
        const url = `/api/workspace/image?path=${encodeURIComponent(relativePath)}`;
        results.push({ path: relativePath, url, markdown: `![\u751F\u6210\u56FE\u7247](${url})` });
      }
      return JSON.stringify({ provider: config.provider, model: config.model, images: results });
    });
    prompts.register({
      id: "image-generation",
      title: "Image generation",
      priority: 35,
      content: "When the user asks to create a raster image, call generate_image. After success, include the returned markdown image verbatim in the final response so the desktop client can preview it. Generated files stay under .ai-agent/generated-images in the active workspace."
    });
  }
};

// ../src/features/tool_policy.ts
var toolPolicy = {
  id: "tool-policy",
  register({ prompts }) {
    prompts.register({
      id: "tool-policy",
      title: "Tool contracts and policy",
      priority: 34,
      content: "Every tool has one purpose, an explicit risk class, required scopes, a bounded output, and an auditable policy decision. Never let a model grant or extend its own principal; deny expired or under-scoped calls before execution."
    });
  }
};

// ../src/task_ledger.ts
var MAX_TASKS = 100;
var MAX_GOAL_LENGTH = 1e3;
var MAX_EVIDENCE = 100;
var MAX_EVIDENCE_LENGTH = 4e3;
async function workspaceKey2(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function ledgerPath(workspace) {
  return `${appDataDir()}/task-ledger/${await workspaceKey2(workspace)}.json`;
}
function validIdempotencyKey(value2) {
  if (value2 === void 0 || value2 === "") return void 0;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(value2)) throw new Error("idempotency_key \u65E0\u6548");
  return value2;
}
function validateTask(raw) {
  if (!raw || typeof raw !== "object") throw new Error("\u4EFB\u52A1\u8D26\u672C\u8BB0\u5F55\u65E0\u6548");
  const value2 = raw;
  const state = String(value2.state ?? "");
  if (!["planned", "running", "verified", "blocked"].includes(state)) {
    throw new Error("\u4EFB\u52A1\u72B6\u6001\u65E0\u6548");
  }
  const evidence = Array.isArray(value2.evidence) ? value2.evidence.map((item) => {
    if (!item || typeof item !== "object") throw new Error("\u4EFB\u52A1\u8BC1\u636E\u65E0\u6548");
    const entry = item;
    const summary = String(entry.summary ?? "").trim();
    if (!summary || summary.length > MAX_EVIDENCE_LENGTH) throw new Error("\u4EFB\u52A1\u8BC1\u636E\u8FC7\u957F\u6216\u4E3A\u7A7A");
    return {
      id: String(entry.id ?? ""),
      summary,
      checkpoint: String(entry.checkpoint ?? ""),
      idempotencyKey: typeof entry.idempotencyKey === "string" ? entry.idempotencyKey : void 0,
      createdAt: String(entry.createdAt ?? "")
    };
  }) : [];
  if (evidence.length > MAX_EVIDENCE) throw new Error("\u4EFB\u52A1\u8BC1\u636E\u8FC7\u591A");
  const goal = String(value2.goal ?? "").trim();
  const id = String(value2.id ?? "");
  if (!/^task-[A-Za-z0-9-]{8,40}$/.test(id) || !goal || goal.length > MAX_GOAL_LENGTH) {
    throw new Error("\u4EFB\u52A1\u76EE\u6807\u6216 ID \u65E0\u6548");
  }
  const revision = Number(value2.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("\u4EFB\u52A1 revision \u65E0\u6548");
  const idempotencyKeys = Array.isArray(value2.idempotencyKeys) ? value2.idempotencyKeys.map((key5) => validIdempotencyKey(String(key5))).filter(Boolean) : [];
  return {
    id,
    goal,
    state,
    evidence,
    revision,
    createdAt: String(value2.createdAt ?? ""),
    updatedAt: String(value2.updatedAt ?? ""),
    idempotencyKeys
  };
}
async function readTasks(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await ledgerPath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_TASKS) throw new Error("\u4EFB\u52A1\u8D26\u672C\u65E0\u6548");
    return value2.map(validateTask);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveTasks(workspace, tasks) {
  if (tasks.length > MAX_TASKS) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_TASKS} \u4E2A\u4EFB\u52A1`);
  await writeJsonAtomic(await ledgerPath(workspace), tasks);
}
function cloneTask(task) {
  return {
    ...task,
    evidence: task.evidence.map((item) => ({ ...item })),
    idempotencyKeys: [...task.idempotencyKeys]
  };
}
function touch2(task) {
  task.revision += 1;
  task.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
}
function idempotent(task, key5) {
  return Boolean(key5 && task.idempotencyKeys.includes(key5));
}
async function createTask(workspace, goal, idempotencyKey3) {
  const normalizedGoal = goal.trim();
  if (!normalizedGoal || normalizedGoal.length > MAX_GOAL_LENGTH) throw new Error("goal \u65E0\u6548");
  const key5 = validIdempotencyKey(idempotencyKey3), tasks = await readTasks(workspace);
  if (key5) {
    const existing = tasks.find((task2) => task2.idempotencyKeys.includes(key5));
    if (existing) return cloneTask(existing);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const task = {
    id: `task-${crypto.randomUUID().slice(0, 12)}`,
    goal: normalizedGoal,
    state: "planned",
    evidence: [],
    revision: 0,
    createdAt: now,
    updatedAt: now,
    idempotencyKeys: key5 ? [key5] : []
  };
  tasks.unshift(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}
async function checkpointTask(workspace, id, summary, checkpoint, idempotencyKey3) {
  const key5 = validIdempotencyKey(idempotencyKey3), tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
  if (key5 && idempotent(task, key5)) return cloneTask(task);
  const normalized = summary.trim(), marker = checkpoint.trim();
  if (!normalized || normalized.length > MAX_EVIDENCE_LENGTH) throw new Error("evidence \u65E0\u6548");
  if (!marker || marker.length > 200) throw new Error("checkpoint \u65E0\u6548");
  if (task.state === "verified") throw new Error("\u5DF2\u9A8C\u8BC1\u4EFB\u52A1\u4E0D\u80FD\u7EE7\u7EED checkpoint");
  if (task.evidence.length >= MAX_EVIDENCE) throw new Error("\u4EFB\u52A1\u8BC1\u636E\u5DF2\u8FBE\u4E0A\u9650");
  task.evidence.push({
    id: `evidence-${crypto.randomUUID().slice(0, 12)}`,
    summary: normalized,
    checkpoint: marker,
    idempotencyKey: key5,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (key5) task.idempotencyKeys.push(key5);
  task.state = "running";
  touch2(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}
async function verifyTask(workspace, id, idempotencyKey3) {
  const key5 = validIdempotencyKey(idempotencyKey3), tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
  if (task.state === "verified" || key5 && idempotent(task, key5)) return cloneTask(task);
  if (!task.evidence.length) throw new Error("\u6CA1\u6709 evidence\uFF0C\u4E0D\u80FD verified");
  task.state = "verified";
  if (key5) task.idempotencyKeys.push(key5);
  touch2(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}
async function resumeTask(workspace, id) {
  const tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
  return cloneTask(task);
}

// ../src/features/task_state.ts
function definition5(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function taskOutput(task) {
  const evidence = task.evidence.slice(-8).map((item) => ({
    ...item,
    summary: item.summary.slice(0, 500)
  }));
  return JSON.stringify({ task: { ...task, evidence, evidenceCount: task.evidence.length } });
}
var taskState = {
  id: "task-state",
  register({ tools, prompts }) {
    tools.register(
      definition5("task_create", "Create a durable task ledger entry", {
        goal: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["goal"]),
      async (input, context) => taskOutput(
        await createTask(
          context.workspace,
          String(input.goal ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        )
      )
    );
    tools.register(
      definition5("task_checkpoint", "Record evidence and a replay checkpoint", {
        id: { type: "string" },
        evidence: { type: "string" },
        checkpoint: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["id", "evidence", "checkpoint"]),
      async (input, context) => taskOutput(
        await checkpointTask(
          context.workspace,
          String(input.id ?? ""),
          String(input.evidence ?? ""),
          String(input.checkpoint ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        )
      )
    );
    tools.register(
      definition5("task_verify", "Verify a task only when evidence exists", {
        id: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["id"]),
      async (input, context) => taskOutput(
        await verifyTask(
          context.workspace,
          String(input.id ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        )
      )
    );
    tools.register(
      definition5("task_resume", "Read durable task state before continuing work", {
        id: { type: "string" }
      }, ["id"]),
      async (input, context) => taskOutput(await resumeTask(context.workspace, String(input.id ?? "")))
    );
    prompts.register({
      id: "task-state",
      title: "Task state and replay",
      priority: 35,
      content: "Long tasks keep an explicit goal, state, evidence, checkpoint, and idempotency key. Resume from durable evidence; never repeat a side effect merely because the chat history is incomplete, and never mark a task verified without evidence."
    });
  }
};

// ../src/worker_queue.ts
var MAX_JOBS = 500;
var MAX_PAYLOAD = 2e3;
var DEFAULT_LEASE_SECONDS = 30;
var MAX_LEASE_SECONDS = 3600;
var DEFAULT_MAX_ATTEMPTS = 3;
var MAX_ATTEMPTS = 10;
var queueLocks = /* @__PURE__ */ new Map();
async function withQueueLock(workspace, operation) {
  const previous = queueLocks.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  queueLocks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queueLocks.get(workspace) === current) queueLocks.delete(workspace);
  }
}
async function workspaceKey3(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function queuePath(workspace) {
  return `${appDataDir()}/worker-queue/${await workspaceKey3(workspace)}.json`;
}
function idempotencyKey2(value2) {
  if (value2 === void 0 || value2 === "") return void 0;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(value2)) throw new Error("idempotency_key \u65E0\u6548");
  return value2;
}
function normalizeJob(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Worker Job \u65E0\u6548");
  const value2 = raw;
  const status = String(value2.status ?? "");
  if (!["queued", "leased", "done", "dead"].includes(status)) throw new Error("Worker \u72B6\u6001\u65E0\u6548");
  const payload = String(value2.payload ?? "");
  const attempts = Number(value2.attempts ?? 0), maxAttempts = Number(value2.maxAttempts ?? 3);
  if (!Number.isInteger(attempts) || attempts < 0 || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Worker attempts \u65E0\u6548");
  }
  return {
    id: String(value2.id ?? ""),
    taskId: typeof value2.taskId === "string" ? value2.taskId : void 0,
    traceId: typeof value2.traceId === "string" ? value2.traceId : void 0,
    payload: payload.slice(0, MAX_PAYLOAD),
    status,
    attempts,
    maxAttempts: Math.min(maxAttempts, MAX_ATTEMPTS),
    leaseOwner: typeof value2.leaseOwner === "string" ? value2.leaseOwner : void 0,
    leaseUntil: typeof value2.leaseUntil === "string" ? value2.leaseUntil : void 0,
    nextAttemptAt: typeof value2.nextAttemptAt === "string" ? value2.nextAttemptAt : void 0,
    lastError: typeof value2.lastError === "string" ? value2.lastError.slice(0, 1e3) : void 0,
    idempotencyKey: typeof value2.idempotencyKey === "string" ? value2.idempotencyKey : void 0,
    createdAt: String(value2.createdAt ?? ""),
    updatedAt: String(value2.updatedAt ?? "")
  };
}
async function readJobs(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await queuePath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_JOBS) throw new Error("Worker Queue \u65E0\u6548");
    return value2.map(normalizeJob);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveJobs(workspace, jobs2) {
  if (jobs2.length > MAX_JOBS) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_JOBS} \u4E2A Worker Job`);
  await writeJsonAtomic(await queuePath(workspace), jobs2);
}
function cloneJob(job) {
  return { ...job };
}
function touch3(job) {
  job.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
}
function reclaimExpired(jobs2, now = Date.now()) {
  for (const job of jobs2) {
    if (job.status !== "leased" || !job.leaseUntil) continue;
    if (Date.parse(job.leaseUntil) > now) continue;
    job.leaseOwner = void 0;
    job.leaseUntil = void 0;
    if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      job.lastError = "Lease expired after maximum attempts";
    } else {
      job.status = "queued";
      job.nextAttemptAt = new Date(now).toISOString();
      job.lastError = "Lease expired; queued for retry";
    }
    touch3(job);
  }
}
function due(job, now) {
  return !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= now;
}
async function enqueueWorkerJob(workspace, payload, options = {}) {
  return await withQueueLock(workspace, async () => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload || normalizedPayload.length > MAX_PAYLOAD) {
      throw new Error("Worker payload \u65E0\u6548");
    }
    const maxAttempts = Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    if (maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
      throw new Error("max_attempts \u5FC5\u987B\u4E3A 1\u201310");
    }
    const key5 = idempotencyKey2(options.idempotencyKey);
    const jobs2 = await readJobs(workspace);
    reclaimExpired(jobs2);
    if (key5) {
      const existing = jobs2.find((job2) => job2.idempotencyKey === key5);
      if (existing) {
        await saveJobs(workspace, jobs2);
        return cloneJob(existing);
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const job = {
      id: `job-${crypto.randomUUID().slice(0, 12)}`,
      taskId: options.taskId,
      traceId: options.traceId,
      payload: normalizedPayload,
      status: "queued",
      attempts: 0,
      maxAttempts,
      idempotencyKey: key5,
      createdAt: now,
      updatedAt: now
    };
    jobs2.push(job);
    await saveJobs(workspace, jobs2);
    return cloneJob(job);
  });
}
async function leaseWorkerJob(workspace, workerId, leaseSeconds = DEFAULT_LEASE_SECONDS) {
  return await withQueueLock(workspace, async () => {
    const owner = workerId.trim();
    if (!owner || owner.length > 120) throw new Error("worker_id \u65E0\u6548");
    const seconds = Math.floor(leaseSeconds);
    if (seconds < 5 || seconds > MAX_LEASE_SECONDS) {
      throw new Error("lease_seconds \u5FC5\u987B\u4E3A 5\u20133600");
    }
    const jobs2 = await readJobs(workspace), now = Date.now();
    reclaimExpired(jobs2, now);
    const job = jobs2.find((item) => item.status === "queued" && due(item, now));
    if (!job) {
      await saveJobs(workspace, jobs2);
      return void 0;
    }
    job.status = "leased";
    job.attempts += 1;
    job.leaseOwner = owner;
    job.leaseUntil = new Date(now + seconds * 1e3).toISOString();
    job.nextAttemptAt = void 0;
    touch3(job);
    await saveJobs(workspace, jobs2);
    return cloneJob(job);
  });
}
async function settleWorkerJob(workspace, id, workerId, success, error) {
  return await withQueueLock(workspace, async () => {
    const jobs2 = await readJobs(workspace), job = jobs2.find((item) => item.id === id);
    if (!job) throw new Error("Worker Job \u4E0D\u5B58\u5728");
    if (job.status !== "leased") throw new Error("Worker Job \u5F53\u524D\u4E0D\u5728 leased \u72B6\u6001");
    if (job.leaseUntil && Date.parse(job.leaseUntil) <= Date.now()) {
      reclaimExpired(jobs2);
      await saveJobs(workspace, jobs2);
      throw new Error("Worker Lease \u5DF2\u8FC7\u671F\uFF0CJob \u5DF2\u56DE\u6536");
    }
    if (job.leaseOwner !== workerId.trim()) throw new Error("Worker Lease \u6240\u6709\u8005\u4E0D\u5339\u914D");
    job.leaseOwner = void 0;
    job.leaseUntil = void 0;
    if (success) {
      job.status = "done";
      job.lastError = void 0;
    } else if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      job.lastError = String(error ?? "Worker failed").slice(0, 1e3);
    } else {
      job.status = "queued";
      job.lastError = String(error ?? "Worker failed").slice(0, 1e3);
      const delay = Math.min(6e4, 1e3 * 2 ** Math.max(0, job.attempts - 1));
      job.nextAttemptAt = new Date(Date.now() + delay).toISOString();
    }
    touch3(job);
    await saveJobs(workspace, jobs2);
    return cloneJob(job);
  });
}
async function readWorkerJobs(workspace, id) {
  return await withQueueLock(workspace, async () => {
    const jobs2 = await readJobs(workspace);
    reclaimExpired(jobs2);
    await saveJobs(workspace, jobs2);
    return jobs2.filter((job) => !id || job.id === id).map(cloneJob);
  });
}

// ../src/features/worker_queue.ts
function definition6(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function compact(job) {
  return { ...job, payload: job.payload.slice(0, 240), lastError: job.lastError?.slice(0, 240) };
}
function workerOutput(job, jobs2 = []) {
  return JSON.stringify({
    worker: job ? compact(job) : null,
    workers: jobs2.slice(-20).map(compact)
  });
}
var workerQueue = {
  id: "worker-queue",
  register({ tools, prompts }) {
    tools.register(
      definition6(
        "worker_enqueue",
        "Enqueue a durable worker job for bounded background processing",
        {
          payload: { type: "string" },
          task_id: { type: "string" },
          trace_id: { type: "string" },
          max_attempts: { type: "integer", minimum: 1, maximum: 10 },
          idempotency_key: { type: "string" }
        },
        ["payload"]
      ),
      async (input, context) => workerOutput(
        await enqueueWorkerJob(
          context.workspace,
          String(input.payload ?? ""),
          {
            taskId: typeof input.task_id === "string" ? input.task_id : void 0,
            traceId: typeof input.trace_id === "string" ? input.trace_id : void 0,
            maxAttempts: typeof input.max_attempts === "number" ? input.max_attempts : void 0,
            idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
          }
        )
      )
    );
    tools.register(
      definition6("worker_lease", "Claim the next due worker job with a time-bounded lease", {
        worker_id: { type: "string" },
        lease_seconds: { type: "integer", minimum: 5, maximum: 3600 }
      }, ["worker_id"]),
      async (input, context) => workerOutput(
        await leaseWorkerJob(
          context.workspace,
          String(input.worker_id ?? ""),
          typeof input.lease_seconds === "number" ? input.lease_seconds : void 0
        )
      )
    );
    tools.register(
      definition6(
        "worker_settle",
        "Complete or fail a leased worker job; failures retry or dead-letter",
        {
          id: { type: "string" },
          worker_id: { type: "string" },
          success: { type: "boolean" },
          error: { type: "string" }
        },
        ["id", "worker_id", "success"]
      ),
      async (input, context) => workerOutput(
        await settleWorkerJob(
          context.workspace,
          String(input.id ?? ""),
          String(input.worker_id ?? ""),
          input.success === true,
          typeof input.error === "string" ? input.error : void 0
        )
      )
    );
    tools.register(
      definition6("worker_status", "Read current worker queue jobs and retry/dead-letter state", {
        id: { type: "string" }
      }, []),
      async (input, context) => {
        const jobs2 = await readWorkerJobs(
          context.workspace,
          typeof input.id === "string" ? input.id : void 0
        );
        return workerOutput(jobs2.at(-1) ?? null, jobs2);
      }
    );
    prompts.register({
      id: "worker-workloads",
      title: "Worker queue and leases",
      priority: 36,
      content: "Use the Worker Queue for bounded background work: enqueue a small idempotent payload, lease it with a worker identity, and settle it explicitly. Leases expire and are reclaimed; failed attempts use bounded exponential retry and become Dead Letter after max_attempts. Never claim a job without a worker_id, and never hide a dead-lettered job from the user."
    });
  }
};

// ../src/handoff.ts
var MAX_HANDOFFS = 100;
var MAX_OBJECTIVE_LENGTH = 1e3;
var MAX_ROLE_LENGTH = 120;
var MAX_TENANT_LENGTH2 = 120;
var MAX_TRACE_ID_LENGTH = 120;
var MAX_ARTIFACTS = 20;
var MAX_ARTIFACT_LENGTH = 1e4;
var MAX_EVIDENCE2 = 40;
var MAX_EVIDENCE_LENGTH2 = 4e3;
var MAX_FAILURE_LENGTH = 1e3;
var KEY_PATTERN2 = /^[A-Za-z0-9._:-]{1,120}$/;
var LABEL_PATTERN2 = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
var workspaceLocks2 = /* @__PURE__ */ new Map();
function abortIfNeeded2(signal) {
  if (signal?.aborted) throw new DOMException("Handoff operation cancelled", "AbortError");
}
function text(value2, name, max) {
  const normalized = String(value2 ?? "").trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return normalized;
}
function label2(value2, name, max) {
  const normalized = text(value2, name, max);
  if (!LABEL_PATTERN2.test(normalized)) throw new Error(`${name} \u65E0\u6548`);
  return normalized;
}
function key2(value2, name = "idempotency_key") {
  if (value2 === void 0 || value2 === "") return void 0;
  if (!KEY_PATTERN2.test(value2)) throw new Error(`${name} \u65E0\u6548`);
  return value2;
}
function scopedKey2(operation, tenant, idempotencyKey3) {
  return `${operation}:${tenant}:${idempotencyKey3}`;
}
function validateId2(value2) {
  const id = String(value2 ?? "");
  if (!/^handoff-[A-Za-z0-9-]{8,40}$/.test(id)) throw new Error("handoff id \u65E0\u6548");
  return id;
}
function validateRecord2(raw) {
  if (!raw || typeof raw !== "object") throw new Error("handoff \u8BB0\u5F55\u65E0\u6548");
  const value2 = raw;
  const state = String(value2.state ?? "");
  if (!["submitted", "running", "complete", "failed"].includes(state)) {
    throw new Error("handoff \u72B6\u6001\u65E0\u6548");
  }
  const artifacts = Array.isArray(value2.artifacts) ? value2.artifacts.map((artifact) => text(artifact, "artifact", MAX_ARTIFACT_LENGTH)) : [];
  if (artifacts.length > MAX_ARTIFACTS) throw new Error("handoff artifact \u8FC7\u591A");
  const evidence = Array.isArray(value2.evidence) ? value2.evidence.map((item) => {
    if (!item || typeof item !== "object") throw new Error("handoff evidence \u65E0\u6548");
    const entry = item;
    return {
      id: text(entry.id, "evidence id", 80),
      summary: text(entry.summary, "evidence summary", MAX_EVIDENCE_LENGTH2),
      checkpoint: text(entry.checkpoint, "checkpoint", 200),
      createdAt: text(entry.createdAt, "evidence createdAt", 80)
    };
  }) : [];
  if (evidence.length > MAX_EVIDENCE2) throw new Error("handoff evidence \u8FC7\u591A");
  const idempotencyKeys = Array.isArray(value2.idempotencyKeys) ? value2.idempotencyKeys.map((item) => text(item, "idempotency key", 300)).slice(0, 80) : [];
  const revision = Number(value2.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("handoff revision \u65E0\u6548");
  return {
    id: validateId2(value2.id),
    tenant: label2(value2.tenant, "tenant", MAX_TENANT_LENGTH2),
    role: label2(value2.role, "role", MAX_ROLE_LENGTH),
    objective: text(value2.objective, "objective", MAX_OBJECTIVE_LENGTH),
    traceId: text(value2.traceId, "trace_id", MAX_TRACE_ID_LENGTH),
    state,
    artifacts,
    evidence,
    failureReason: typeof value2.failureReason === "string" ? value2.failureReason.slice(0, MAX_FAILURE_LENGTH) : void 0,
    revision,
    createdAt: text(value2.createdAt, "createdAt", 80),
    updatedAt: text(value2.updatedAt, "updatedAt", 80),
    idempotencyKeys
  };
}
async function workspaceKey4(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function handoffPath(workspace) {
  return `${appDataDir()}/handoffs/${await workspaceKey4(workspace)}.json`;
}
async function readRecords2(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await handoffPath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_HANDOFFS) throw new Error("handoff \u5B58\u50A8\u65E0\u6548");
    return value2.map(validateRecord2);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveRecords2(workspace, records) {
  if (records.length > MAX_HANDOFFS) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_HANDOFFS} \u4E2A handoff`);
  await writeJsonAtomic(await handoffPath(workspace), records);
}
function clone2(record) {
  return {
    ...record,
    artifacts: [...record.artifacts],
    evidence: record.evidence.map((item) => ({ ...item })),
    idempotencyKeys: [...record.idempotencyKeys]
  };
}
function touch4(record) {
  record.revision += 1;
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
}
async function withWorkspaceLock2(workspace, operation) {
  const previous = workspaceLocks2.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  workspaceLocks2.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (workspaceLocks2.get(workspace) === current) workspaceLocks2.delete(workspace);
  }
}
function findRecord(records, id, tenant) {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error("handoff \u4E0D\u5B58\u5728");
  if (record.tenant !== tenant) throw new Error("handoff tenant \u4E0D\u5339\u914D");
  return record;
}
async function submitHandoff(workspace, input, signal) {
  abortIfNeeded2(signal);
  const tenant = label2(input.tenant, "tenant", MAX_TENANT_LENGTH2);
  const role = label2(input.role, "role", MAX_ROLE_LENGTH);
  const objective = text(input.objective, "objective", MAX_OBJECTIVE_LENGTH);
  const traceId = input.traceId ? text(input.traceId, "trace_id", MAX_TRACE_ID_LENGTH) : `trace-${crypto.randomUUID()}`;
  const idempotencyKey3 = key2(input.idempotencyKey);
  return await withWorkspaceLock2(workspace, async () => {
    abortIfNeeded2(signal);
    const records = await readRecords2(workspace);
    const operationKey = idempotencyKey3 && scopedKey2("submit", tenant, idempotencyKey3);
    const existing = operationKey && records.find((item) => item.idempotencyKeys.includes(operationKey));
    if (existing) return clone2(existing);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: `handoff-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      role,
      objective,
      traceId,
      state: "submitted",
      artifacts: [],
      evidence: [],
      revision: 0,
      createdAt: now,
      updatedAt: now,
      idempotencyKeys: operationKey ? [operationKey] : []
    };
    records.unshift(record);
    await saveRecords2(workspace, records);
    return clone2(record);
  });
}
async function transferHandoff(workspace, id, tenant, artifact, summary, checkpoint, idempotencyKey3, signal) {
  abortIfNeeded2(signal);
  const handoffId = validateId2(id);
  const normalizedTenant = label2(tenant, "tenant", MAX_TENANT_LENGTH2);
  const normalizedArtifact = text(artifact, "artifact", MAX_ARTIFACT_LENGTH);
  const normalizedSummary = text(summary, "evidence summary", MAX_EVIDENCE_LENGTH2);
  const normalizedCheckpoint = text(checkpoint, "checkpoint", 200);
  const normalizedKey = key2(idempotencyKey3);
  return await withWorkspaceLock2(workspace, async () => {
    abortIfNeeded2(signal);
    const records = await readRecords2(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey2("transfer", normalizedTenant, normalizedKey);
    if (operationKey && record.idempotencyKeys.includes(operationKey)) return clone2(record);
    if (record.state === "complete" || record.state === "failed") {
      throw new Error(`handoff \u5DF2\u5904\u4E8E\u7EC8\u6001\uFF1A${record.state}`);
    }
    if (record.artifacts.length >= MAX_ARTIFACTS) throw new Error("handoff artifact \u5DF2\u8FBE\u4E0A\u9650");
    if (record.evidence.length >= MAX_EVIDENCE2) throw new Error("handoff evidence \u5DF2\u8FBE\u4E0A\u9650");
    record.artifacts.push(normalizedArtifact);
    record.evidence.push({
      id: `evidence-${crypto.randomUUID().slice(0, 12)}`,
      summary: normalizedSummary,
      checkpoint: normalizedCheckpoint,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    record.state = "running";
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch4(record);
    await saveRecords2(workspace, records);
    return clone2(record);
  });
}
async function completeHandoff(workspace, id, tenant, idempotencyKey3, signal) {
  abortIfNeeded2(signal);
  const handoffId = validateId2(id);
  const normalizedTenant = label2(tenant, "tenant", MAX_TENANT_LENGTH2);
  const normalizedKey = key2(idempotencyKey3);
  return await withWorkspaceLock2(workspace, async () => {
    abortIfNeeded2(signal);
    const records = await readRecords2(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey2("complete", normalizedTenant, normalizedKey);
    if (record.state === "complete") return clone2(record);
    if (record.state === "failed") throw new Error("\u5931\u8D25\u7684 handoff \u4E0D\u80FD\u5B8C\u6210");
    if (!record.artifacts.length || !record.evidence.length) {
      throw new Error("handoff \u7F3A\u5C11 artifact \u6216 evidence\uFF0C\u4E0D\u80FD\u5B8C\u6210");
    }
    record.state = "complete";
    if (operationKey && !record.idempotencyKeys.includes(operationKey)) {
      record.idempotencyKeys.push(operationKey);
    }
    touch4(record);
    await saveRecords2(workspace, records);
    return clone2(record);
  });
}
async function failHandoff(workspace, id, tenant, reason, idempotencyKey3, signal) {
  abortIfNeeded2(signal);
  const handoffId = validateId2(id);
  const normalizedTenant = label2(tenant, "tenant", MAX_TENANT_LENGTH2);
  const normalizedReason = text(reason, "failure_reason", MAX_FAILURE_LENGTH);
  const normalizedKey = key2(idempotencyKey3);
  return await withWorkspaceLock2(workspace, async () => {
    abortIfNeeded2(signal);
    const records = await readRecords2(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey2("fail", normalizedTenant, normalizedKey);
    if (record.state === "failed") return clone2(record);
    if (record.state === "complete") throw new Error("\u5DF2\u5B8C\u6210\u7684 handoff \u4E0D\u80FD\u5931\u8D25");
    record.state = "failed";
    record.failureReason = normalizedReason;
    if (operationKey && !record.idempotencyKeys.includes(operationKey)) {
      record.idempotencyKeys.push(operationKey);
    }
    touch4(record);
    await saveRecords2(workspace, records);
    return clone2(record);
  });
}
async function readHandoffs(workspace, options = {}) {
  const records = await readRecords2(workspace);
  const id = options.id ? validateId2(options.id) : void 0;
  const tenant = options.tenant ? label2(options.tenant, "tenant", MAX_TENANT_LENGTH2) : void 0;
  return records.filter(
    (record) => (!id || record.id === id) && (!tenant || record.tenant === tenant)
  ).map(clone2);
}

// ../src/features/handoff.ts
function definition7(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function compact2(record) {
  return {
    ...record,
    artifacts: record.artifacts.slice(-8).map((artifact) => artifact.slice(0, 500)),
    evidence: record.evidence.slice(-8).map((item) => ({
      ...item,
      summary: item.summary.slice(0, 500)
    })),
    idempotencyKeys: []
  };
}
function output(record, records = []) {
  return JSON.stringify({
    handoff: record ? compact2(record) : null,
    handoffs: records.slice(0, 20).map(compact2)
  });
}
var handoff = {
  id: "handoff",
  register({ tools, prompts }) {
    tools.register(
      definition7("handoff_submit", "Submit a tenant-scoped, trace-linked A2A handoff", {
        tenant: { type: "string" },
        role: { type: "string" },
        objective: { type: "string" },
        trace_id: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["tenant", "role", "objective"]),
      async (input, context) => output(
        await submitHandoff(
          context.workspace,
          {
            tenant: String(input.tenant ?? ""),
            role: String(input.role ?? ""),
            objective: String(input.objective ?? ""),
            traceId: typeof input.trace_id === "string" ? input.trace_id : void 0,
            idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
          },
          context.signal
        )
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition7("agent_handoff", "Transfer bounded artifact and evidence to an A2A receiver", {
        id: { type: "string" },
        tenant: { type: "string" },
        artifact: { type: "string" },
        evidence: { type: "string" },
        checkpoint: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["id", "tenant", "artifact", "evidence", "checkpoint"]),
      async (input, context) => output(
        await transferHandoff(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          String(input.artifact ?? ""),
          String(input.evidence ?? ""),
          String(input.checkpoint ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0,
          context.signal
        )
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition7("handoff_complete", "Complete an A2A handoff only when evidence exists", {
        id: { type: "string" },
        tenant: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["id", "tenant"]),
      async (input, context) => output(
        await completeHandoff(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0,
          context.signal
        )
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition7("handoff_fail", "Mark an A2A handoff failed with durable evidence", {
        id: { type: "string" },
        tenant: { type: "string" },
        reason: { type: "string" },
        idempotency_key: { type: "string" }
      }, ["id", "tenant", "reason"]),
      async (input, context) => output(
        await failHandoff(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          String(input.reason ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0,
          context.signal
        )
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition7("handoff_status", "Read tenant-scoped A2A handoff state and evidence", {
        id: { type: "string" },
        tenant: { type: "string" }
      }, ["tenant"]),
      async (input, context) => {
        const records = await readHandoffs(context.workspace, {
          id: typeof input.id === "string" ? input.id : void 0,
          tenant: String(input.tenant ?? "")
        });
        return output(records.at(0) ?? null, records);
      }
    );
    prompts.register({
      id: "a2a-handoff",
      title: "A2A handoff guardrails",
      priority: 38,
      content: "A2A handoffs must carry a tenant, receiver role, objective, trace_id, bounded artifact, and evidence checkpoint. Submit with an idempotency key when retries are possible, transfer evidence before completion, and never complete a handoff without durable evidence. Tenant mismatch, terminal-state mutation, oversized artifacts, cancellation, and missing evidence must be rejected."
    });
  }
};

// ../src/features/memory_rag.ts
function definition8(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function compact3(record) {
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
    revision: record.revision
  };
}
var memoryRag = {
  id: "memory-rag",
  register({ tools, prompts }) {
    tools.register(
      definition8(
        "memory_migrate_legacy",
        "Migrate legacy Markdown memory into typed Memory once",
        {},
        []
      ),
      async (_input, context) => {
        const result = await migrateLegacyMemory(context.workspace, context.signal);
        return JSON.stringify({
          migrated: result.migrated,
          memory: result.record ? compact3(result.record) : null
        });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 2e4 }
    );
    tools.register(
      definition8("memory_store", "Store tenant-scoped semantic, episodic, or procedural memory", {
        tenant: { type: "string" },
        kind: { type: "string", enum: ["semantic", "episodic", "procedural"] },
        text: { type: "string" },
        source: { type: "string" },
        expires_at: { type: "integer" },
        idempotency_key: { type: "string" }
      }, ["tenant", "kind", "text"]),
      async (input, context) => {
        const record = await writeMemory(context.workspace, {
          tenant: String(input.tenant ?? ""),
          kind: String(input.kind ?? ""),
          text: String(input.text ?? ""),
          source: typeof input.source === "string" ? input.source : void 0,
          expiresAt: typeof input.expires_at === "number" ? input.expires_at : void 0,
          idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        }, context.signal);
        return JSON.stringify({ memory: compact3(record) });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 2e4 }
    );
    tools.register(
      definition8(
        "memory_search",
        "Retrieve grounded tenant memory before using long-term context",
        {
          tenant: { type: "string" },
          query: { type: "string" },
          kind: { type: "string", enum: ["semantic", "episodic", "procedural"] },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        },
        ["tenant", "query"]
      ),
      async (input, context) => {
        const hits = await searchMemory(context.workspace, {
          tenant: String(input.tenant ?? ""),
          query: String(input.query ?? ""),
          kind: typeof input.kind === "string" ? input.kind : void 0,
          limit: typeof input.limit === "number" ? input.limit : void 0
        }, context.signal);
        return JSON.stringify({
          retrievalMode: "lexical",
          hits,
          citations: hits.map((hit) => hit.citation)
        });
      }
    );
    tools.register(
      definition8(
        "memory_tombstone",
        "Tombstone a tenant-scoped memory without deleting audit evidence",
        {
          id: { type: "string" },
          tenant: { type: "string" },
          idempotency_key: { type: "string" }
        },
        ["id", "tenant"]
      ),
      async (input, context) => {
        const record = await tombstoneMemory(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          typeof input.idempotency_key === "string" ? input.idempotency_key : void 0,
          context.signal
        );
        return JSON.stringify({ memory: compact3(record) });
      },
      { risk: "mutating", scopes: ["mutating"], maxOutput: 2e4 }
    );
    tools.register(
      definition8("memory_status", "Inspect tenant-scoped memory records and retention state", {
        tenant: { type: "string" },
        include_deleted: { type: "boolean" }
      }, ["tenant"]),
      async (input, context) => {
        const records = await readMemoryRecords(context.workspace, {
          tenant: String(input.tenant ?? ""),
          includeDeleted: input.include_deleted === true
        });
        return JSON.stringify({ records: records.slice(0, 50).map(compact3) });
      }
    );
    prompts.register({
      id: "memory-rag",
      title: "RAG and tenant memory",
      priority: 39,
      content: "Long-term memory is a bounded service, not an infinite chat history. Before relying on durable memory, call memory_search with the correct tenant and query, use only returned evidence and citations, and distinguish semantic, episodic, and procedural records. Never cross tenant boundaries, inject deleted or expired records, or claim a memory fact without a citation. Store stable non-secret facts with memory_store and use tombstones for deletion."
    });
  }
};

// ../src/research_service.ts
var MAX_RESEARCH = 100;
var MAX_SOURCES = 20;
var MAX_SOURCE_TEXT = 12e3;
var MAX_QUERY = 1e3;
var MAX_TITLE = 240;
var MAX_TENANT = 120;
var MAX_IDEMPOTENCY = 120;
var RESEARCH_ID = /^research-[A-Za-z0-9-]{8,40}$/;
var SOURCE_ID = /^source-[A-Za-z0-9-]{8,40}$/;
var KEY_PATTERN3 = /^[A-Za-z0-9._:-]{1,120}$/;
var LABEL_PATTERN3 = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
var workspaceLocks3 = /* @__PURE__ */ new Map();
function abortIfNeeded3(signal) {
  if (signal?.aborted) throw new DOMException("Research operation cancelled", "AbortError");
}
function text2(value2, name, max) {
  const result = String(value2 ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return result;
}
function label3(value2, name) {
  const result = text2(value2, name, MAX_TENANT);
  if (!LABEL_PATTERN3.test(result)) throw new Error(`${name} \u65E0\u6548`);
  return result;
}
function key3(value2) {
  if (value2 === void 0 || value2 === "") return void 0;
  if (value2.length > MAX_IDEMPOTENCY || !KEY_PATTERN3.test(value2)) {
    throw new Error("idempotency_key \u65E0\u6548");
  }
  return value2;
}
function validateId3(value2, pattern, name) {
  const result = String(value2 ?? "");
  if (!pattern.test(result)) throw new Error(`${name} \u65E0\u6548`);
  return result;
}
function safeUrl(value2) {
  const result = text2(value2, "url", 2e3);
  let parsed;
  try {
    parsed = new URL(result);
  } catch {
    throw new Error("url \u65E0\u6548");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.username || parsed.password) throw new Error("\u7814\u7A76\u6765\u6E90 URL \u4E0D\u5F97\u5305\u542B\u51ED\u636E");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("\u7814\u7A76\u6765\u6E90\u53EA\u5141\u8BB8 HTTPS \u6216 localhost HTTP");
  }
  return parsed.toString();
}
function fetchedAt(value2) {
  const result = text2(value2, "fetched_at", 80);
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp)) throw new Error("fetched_at \u65E0\u6548");
  return new Date(timestamp).toISOString();
}
function numberInRange(value2, name, min, max, integer = false) {
  const result = Number(value2);
  if (!Number.isFinite(result) || result < min || result > max || integer && !Number.isInteger(result)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return integer ? Math.trunc(result) : result;
}
function scopedKey3(operation, tenant, value2) {
  return `${operation}:${tenant}:${value2}`;
}
function validateSource(raw) {
  if (!raw || typeof raw !== "object") throw new Error("research source \u65E0\u6548");
  const value2 = raw;
  const quality = numberInRange(value2.quality, "quality", 0, 1);
  return {
    id: validateId3(value2.id, SOURCE_ID, "source id"),
    url: safeUrl(value2.url),
    title: text2(value2.title, "title", MAX_TITLE),
    text: text2(value2.text, "source text", MAX_SOURCE_TEXT),
    fetchedAt: fetchedAt(value2.fetchedAt),
    quality,
    fresh: value2.fresh === true,
    createdAt: text2(value2.createdAt, "source createdAt", 80)
  };
}
function validateRecord3(raw) {
  if (!raw || typeof raw !== "object") throw new Error("research record \u65E0\u6548");
  const value2 = raw;
  const state = String(value2.state ?? "");
  if (!["planned", "collecting", "complete", "escalated"].includes(state)) {
    throw new Error("research \u72B6\u6001\u65E0\u6548");
  }
  const revision = Number(value2.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("research revision \u65E0\u6548");
  const sources = Array.isArray(value2.sources) ? value2.sources.map(validateSource) : [];
  if (sources.length > MAX_SOURCES) throw new Error("research \u6765\u6E90\u8FC7\u591A");
  const maxSources = numberInRange(value2.maxSources, "max_sources", 1, MAX_SOURCES, true);
  const freshnessHours = numberInRange(value2.freshnessHours, "freshness_hours", 1, 720, true);
  const minConfidence = numberInRange(value2.minConfidence, "min_confidence", 0.1, 0.99);
  const citations = Array.isArray(value2.citations) ? value2.citations.map((item) => safeUrl(item)).slice(0, MAX_SOURCES) : [];
  const keys = Array.isArray(value2.idempotencyKeys) ? value2.idempotencyKeys.map((item) => text2(item, "idempotency key", 300)).slice(0, 60) : [];
  return {
    id: validateId3(value2.id, RESEARCH_ID, "research id"),
    tenant: label3(value2.tenant, "tenant"),
    query: text2(value2.query, "query", MAX_QUERY),
    traceId: text2(value2.traceId, "trace_id", 120),
    state,
    maxSources,
    freshnessHours,
    minConfidence,
    sources,
    citations,
    confidence: numberInRange(value2.confidence ?? 0, "confidence", 0, 1),
    answer: typeof value2.answer === "string" ? value2.answer.slice(0, 8e3) : void 0,
    escalationReason: typeof value2.escalationReason === "string" ? value2.escalationReason.slice(0, 1e3) : void 0,
    revision,
    createdAt: text2(value2.createdAt, "createdAt", 80),
    updatedAt: text2(value2.updatedAt, "updatedAt", 80),
    idempotencyKeys: keys
  };
}
async function workspaceKey5(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
}
async function researchPath(workspace) {
  return `${appDataDir()}/research/${await workspaceKey5(workspace)}.json`;
}
async function readRecords3(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await researchPath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_RESEARCH) throw new Error("research \u5B58\u50A8\u65E0\u6548");
    return value2.map(validateRecord3);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveRecords3(workspace, records) {
  if (records.length > MAX_RESEARCH) throw new Error(`\u6700\u591A\u4FDD\u5B58 ${MAX_RESEARCH} \u4E2A research`);
  await writeJsonAtomic(await researchPath(workspace), records);
}
function clone3(record) {
  return {
    ...record,
    sources: record.sources.map((source) => ({ ...source })),
    citations: [...record.citations],
    idempotencyKeys: [...record.idempotencyKeys]
  };
}
function touch5(record) {
  record.revision += 1;
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
}
async function withWorkspaceLock3(workspace, operation) {
  const previous = workspaceLocks3.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  workspaceLocks3.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (workspaceLocks3.get(workspace) === current) workspaceLocks3.delete(workspace);
  }
}
function findRecord2(records, id, tenant) {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error("research \u4E0D\u5B58\u5728");
  if (record.tenant !== tenant) throw new Error("research tenant \u4E0D\u5339\u914D");
  return record;
}
function freshAt(fetchedAtValue, hours, now = Date.now()) {
  const age = now - Date.parse(fetchedAtValue);
  return age >= 0 && age <= hours * 60 * 60 * 1e3;
}
function fresh(source, hours, now = Date.now()) {
  return freshAt(source.fetchedAt, hours, now);
}
async function startResearch(workspace, input, signal) {
  abortIfNeeded3(signal);
  const tenant = label3(input.tenant, "tenant");
  const query = text2(input.query, "query", MAX_QUERY);
  const traceId = input.traceId ? text2(input.traceId, "trace_id", 120) : `trace-${crypto.randomUUID()}`;
  const maxSources = input.maxSources === void 0 ? 8 : numberInRange(input.maxSources, "max_sources", 1, MAX_SOURCES, true);
  const freshnessHours = input.freshnessHours === void 0 ? 168 : numberInRange(input.freshnessHours, "freshness_hours", 1, 720, true);
  const minConfidence = input.minConfidence === void 0 ? 0.6 : numberInRange(input.minConfidence, "min_confidence", 0.1, 0.99);
  const idempotencyKey3 = key3(input.idempotencyKey);
  return await withWorkspaceLock3(workspace, async () => {
    abortIfNeeded3(signal);
    const records = await readRecords3(workspace);
    const operationKey = idempotencyKey3 && scopedKey3("start", tenant, idempotencyKey3);
    const existing = operationKey && records.find((record2) => record2.idempotencyKeys.includes(operationKey));
    if (existing) return clone3(existing);
    if (records.length >= MAX_RESEARCH) throw new Error("research \u4EFB\u52A1\u5DF2\u8FBE\u4E0A\u9650");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: `research-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      query,
      traceId,
      state: "planned",
      maxSources,
      freshnessHours,
      minConfidence,
      sources: [],
      citations: [],
      confidence: 0,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      idempotencyKeys: operationKey ? [operationKey] : []
    };
    records.unshift(record);
    await saveRecords3(workspace, records);
    return clone3(record);
  });
}
async function addResearchSource(workspace, researchId, input, signal) {
  abortIfNeeded3(signal);
  const id = validateId3(researchId, RESEARCH_ID, "research id");
  const tenant = label3(input.tenant, "tenant");
  const sourceUrl = safeUrl(input.url);
  const title = text2(input.title, "title", MAX_TITLE);
  const sourceText = text2(input.text, "source text", MAX_SOURCE_TEXT);
  const fetched = fetchedAt(input.fetchedAt);
  const quality = input.quality === void 0 ? 0.5 : numberInRange(input.quality, "quality", 0, 1);
  const idempotencyKey3 = key3(input.idempotencyKey);
  return await withWorkspaceLock3(workspace, async () => {
    abortIfNeeded3(signal);
    const records = await readRecords3(workspace);
    const record = findRecord2(records, id, tenant);
    const operationKey = idempotencyKey3 && scopedKey3("source", tenant, idempotencyKey3);
    if (operationKey && record.idempotencyKeys.includes(operationKey)) return clone3(record);
    if (record.state === "complete" || record.state === "escalated") {
      throw new Error(`research \u5DF2\u5904\u4E8E\u7EC8\u6001\uFF1A${record.state}`);
    }
    if (record.sources.length >= record.maxSources) throw new Error("research \u6765\u6E90\u5DF2\u8FBE\u4E0A\u9650");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    record.sources.push({
      id: `source-${crypto.randomUUID().slice(0, 12)}`,
      url: sourceUrl,
      title,
      text: sourceText,
      fetchedAt: fetched,
      quality,
      fresh: freshAt(fetched, record.freshnessHours),
      createdAt: now
    });
    record.state = "collecting";
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch5(record);
    await saveRecords3(workspace, records);
    return clone3(record);
  });
}
async function synthesizeResearch(workspace, researchId, tenant, signal) {
  abortIfNeeded3(signal);
  const id = validateId3(researchId, RESEARCH_ID, "research id");
  const normalizedTenant = label3(tenant, "tenant");
  return await withWorkspaceLock3(workspace, async () => {
    abortIfNeeded3(signal);
    const records = await readRecords3(workspace);
    const record = findRecord2(records, id, normalizedTenant);
    if (record.state === "complete" || record.state === "escalated") return clone3(record);
    const now = Date.now();
    for (const source of record.sources) source.fresh = fresh(source, record.freshnessHours, now);
    const usable = record.sources.filter(
      (source) => source.fresh && source.text.length > 0 && source.quality >= 0.35
    );
    const averageQuality = usable.length ? usable.reduce((sum, source) => sum + source.quality, 0) / usable.length : 0;
    const coverage = usable.length / Math.max(1, record.sources.length);
    const confidence = Math.min(1, averageQuality * 0.65 + coverage * 0.35);
    record.confidence = Number(confidence.toFixed(3));
    record.citations = usable.map((source) => source.url);
    if (record.confidence < record.minConfidence || !usable.length) {
      record.state = "escalated";
      record.answer = "\u8BC1\u636E\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u53EF\u9760\u56DE\u7B54";
      record.escalationReason = usable.length ? `confidence ${record.confidence} < threshold ${record.minConfidence}` : "\u6CA1\u6709\u65B0\u9C9C\u4E14\u8D28\u91CF\u8DB3\u591F\u7684\u6765\u6E90";
    } else {
      record.state = "complete";
      record.answer = usable.slice(0, 4).map(
        (source) => `[${source.title}] ${source.text.slice(0, 800)}`
      ).join("\n");
      record.escalationReason = void 0;
    }
    touch5(record);
    await saveRecords3(workspace, records);
    return clone3(record);
  });
}
async function readResearch(workspace, options) {
  const tenant = label3(options.tenant, "tenant");
  const id = options.id ? validateId3(options.id, RESEARCH_ID, "research id") : void 0;
  const records = await readRecords3(workspace);
  return records.filter((record) => record.tenant === tenant && (!id || record.id === id)).map(
    clone3
  );
}

// ../src/features/research.ts
function definition9(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function compact4(record) {
  return {
    id: record.id,
    tenant: record.tenant,
    query: record.query,
    traceId: record.traceId,
    state: record.state,
    confidence: record.confidence,
    minConfidence: record.minConfidence,
    citations: record.citations.slice(0, 20),
    sources: record.sources.slice(-20).map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      fetchedAt: source.fetchedAt,
      quality: source.quality,
      fresh: source.fresh,
      text: source.text.slice(0, 800)
    })),
    answer: record.answer?.slice(0, 8e3),
    escalationReason: record.escalationReason,
    revision: record.revision,
    updatedAt: record.updatedAt
  };
}
function output2(record) {
  return JSON.stringify({
    research: compact4(record),
    escalated: record.state === "escalated",
    citations: record.citations
  });
}
var research = {
  id: "grounded-research",
  register({ tools, prompts }) {
    tools.register(
      definition9(
        "research_start",
        "Create a tenant-scoped, trace-linked grounded research task",
        {
          tenant: { type: "string" },
          query: { type: "string" },
          trace_id: { type: "string" },
          max_sources: { type: "integer", minimum: 1, maximum: 20 },
          freshness_hours: { type: "integer", minimum: 1, maximum: 720 },
          min_confidence: { type: "number", minimum: 0.1, maximum: 0.99 },
          idempotency_key: { type: "string" }
        },
        ["tenant", "query"]
      ),
      async (input, context) => output2(
        await startResearch(context.workspace, {
          tenant: String(input.tenant ?? ""),
          query: String(input.query ?? ""),
          traceId: typeof input.trace_id === "string" ? input.trace_id : void 0,
          maxSources: typeof input.max_sources === "number" ? input.max_sources : void 0,
          freshnessHours: typeof input.freshness_hours === "number" ? input.freshness_hours : void 0,
          minConfidence: typeof input.min_confidence === "number" ? input.min_confidence : void 0,
          idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        }, context.signal)
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition9(
        "research_add_source",
        "Attach one bounded, quality-scored source to a research task",
        {
          id: { type: "string" },
          tenant: { type: "string" },
          url: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          fetched_at: { type: "string" },
          quality: { type: "number", minimum: 0, maximum: 1 },
          idempotency_key: { type: "string" }
        },
        ["id", "tenant", "url", "title", "text", "fetched_at"]
      ),
      async (input, context) => output2(
        await addResearchSource(
          context.workspace,
          String(input.id ?? ""),
          {
            tenant: String(input.tenant ?? ""),
            url: String(input.url ?? ""),
            title: String(input.title ?? ""),
            text: String(input.text ?? ""),
            fetchedAt: String(input.fetched_at ?? ""),
            quality: typeof input.quality === "number" ? input.quality : void 0,
            idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
          },
          context.signal
        )
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition9(
        "grounded_research",
        "Synthesize only fresh, quality-scored sources with citations",
        {
          id: { type: "string" },
          tenant: { type: "string" }
        },
        ["id", "tenant"]
      ),
      async (input, context) => output2(
        await synthesizeResearch(
          context.workspace,
          String(input.id ?? ""),
          String(input.tenant ?? ""),
          context.signal
        )
      )
    );
    tools.register(
      definition9("research_status", "Read tenant-scoped research state, sources, and citations", {
        id: { type: "string" },
        tenant: { type: "string" }
      }, ["tenant"]),
      async (input, context) => {
        const records = await readResearch(context.workspace, {
          id: typeof input.id === "string" ? input.id : void 0,
          tenant: String(input.tenant ?? "")
        });
        const researches = records.slice(0, 20).map(compact4);
        return JSON.stringify({ research: researches[0] ?? null, researches });
      }
    );
    prompts.register({
      id: "grounded-research",
      title: "Grounded research and escalation",
      priority: 40,
      content: "For research questions, plan a bounded task, collect approved sources, then synthesize only fresh and quality-scored evidence. Every factual answer must include citations from grounded_research. If evidence is stale, conflicting, missing, or below min_confidence, preserve the task and escalate instead of guessing. This service does not perform arbitrary network fetching: use an approved HTTPS connector, MCP capability, or bounded worker to obtain source text before research_add_source. Keep tenant and trace_id consistent and use idempotency keys when retries are possible."
    });
  }
};

// ../src/evaluation_service.ts
var MAX_RECORDS2 = 100;
var MAX_CASES = 100;
var MAX_TEXT = 8e3;
var MAX_VERSION = 120;
var MAX_TENANT2 = 120;
var KEY_PATTERN4 = /^[A-Za-z0-9._:-]{1,120}$/;
var LABEL_PATTERN4 = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
var locks = /* @__PURE__ */ new Map();
function abortIfNeeded4(signal) {
  if (signal?.aborted) throw new DOMException("Evaluation operation cancelled", "AbortError");
}
function text3(value2, name, max) {
  const result = String(value2 ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return result;
}
function label4(value2, name) {
  const result = text3(value2, name, MAX_TENANT2);
  if (!LABEL_PATTERN4.test(result)) throw new Error(`${name} \u65E0\u6548`);
  return result;
}
function key4(value2) {
  if (value2 === void 0 || value2 === "") return void 0;
  if (!KEY_PATTERN4.test(value2)) throw new Error("idempotency_key \u65E0\u6548");
  return value2;
}
function numberInRange2(value2, name, min, max) {
  const result = Number(value2);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${name} \u65E0\u6548`);
  return result;
}
function validateCase(raw) {
  if (!raw || typeof raw !== "object") throw new Error("evaluation case \u65E0\u6548");
  const value2 = raw;
  return {
    id: text3(value2.id, "case id", 120),
    input: text3(value2.input, "case input", MAX_TEXT),
    expected: text3(value2.expected, "case expected", MAX_TEXT),
    citation: value2.citation === void 0 ? void 0 : text3(value2.citation, "citation", 2e3)
  };
}
function validateResult(raw) {
  if (!raw || typeof raw !== "object") throw new Error("evaluation result \u65E0\u6548");
  const value2 = raw;
  return {
    id: text3(value2.id, "result id", 120),
    pass: value2.pass === true,
    grounded: value2.grounded === true,
    review: value2.review === true
  };
}
function validateRecord4(raw) {
  if (!raw || typeof raw !== "object") throw new Error("evaluation record \u65E0\u6548");
  const value2 = raw;
  const state = String(value2.state ?? "");
  if (state !== "passed" && state !== "blocked") throw new Error("evaluation \u72B6\u6001\u65E0\u6548");
  const results = Array.isArray(value2.results) ? value2.results.map(validateResult) : [];
  if (results.length > MAX_CASES) throw new Error("evaluation case \u8FC7\u591A");
  const review = Array.isArray(value2.review) ? value2.review.map((item) => text3(item, "review id", 120)).slice(0, MAX_CASES) : [];
  const keys = Array.isArray(value2.idempotencyKeys) ? value2.idempotencyKeys.map((item) => text3(item, "idempotency key", 120)).slice(0, 60) : [];
  const id = text3(value2.id, "evaluation id", 80);
  if (!/^eval-[A-Za-z0-9-]{8,40}$/.test(id)) throw new Error("evaluation id \u65E0\u6548");
  return {
    id,
    tenant: label4(value2.tenant, "tenant"),
    datasetVersion: text3(value2.datasetVersion, "dataset_version", MAX_VERSION),
    traceId: text3(value2.traceId, "trace_id", 120),
    state,
    passRate: numberInRange2(value2.passRate, "pass_rate", 0, 1),
    groundingRate: numberInRange2(value2.groundingRate, "grounding_rate", 0, 1),
    passThreshold: numberInRange2(value2.passThreshold, "pass_threshold", 0.5, 1),
    groundingThreshold: numberInRange2(value2.groundingThreshold, "grounding_threshold", 0.5, 1),
    review,
    results,
    caseCount: numberInRange2(value2.caseCount, "case_count", 0, MAX_CASES),
    revision: numberInRange2(value2.revision, "revision", 0, 1e6),
    createdAt: text3(value2.createdAt, "createdAt", 80),
    updatedAt: text3(value2.updatedAt, "updatedAt", 80),
    idempotencyKeys: keys
  };
}
async function storagePath(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const key5 = [...new Uint8Array(digest)].slice(0, 12).map(
    (value2) => value2.toString(16).padStart(2, "0")
  ).join("");
  return `${appDataDir()}/evaluations/${key5}.json`;
}
async function readRecords4(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await storagePath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_RECORDS2) throw new Error("evaluation \u5B58\u50A8\u65E0\u6548");
    return value2.map(validateRecord4);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function saveRecords4(workspace, records) {
  if (records.length > MAX_RECORDS2) throw new Error("evaluation \u8BB0\u5F55\u5DF2\u8FBE\u4E0A\u9650");
  await writeJsonAtomic(await storagePath(workspace), records);
}
function clone4(record) {
  return {
    ...record,
    review: [...record.review],
    results: record.results.map((result) => ({ ...result })),
    idempotencyKeys: [...record.idempotencyKeys]
  };
}
async function withLock(workspace, operation) {
  const previous = locks.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  locks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(workspace) === current) locks.delete(workspace);
  }
}
async function runEvaluation(workspace, input, signal) {
  abortIfNeeded4(signal);
  const tenant = label4(input.tenant, "tenant");
  const datasetVersion = text3(input.datasetVersion, "dataset_version", MAX_VERSION);
  if (!Array.isArray(input.cases) || input.cases.length === 0 || input.cases.length > MAX_CASES) {
    throw new Error("cases \u6570\u91CF\u65E0\u6548");
  }
  const cases = input.cases.map(validateCase);
  const ids = /* @__PURE__ */ new Set();
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error("case id \u5FC5\u987B\u552F\u4E00");
    ids.add(item.id);
  }
  if (!input.outputs || typeof input.outputs !== "object" || Array.isArray(input.outputs)) {
    throw new Error("outputs \u65E0\u6548");
  }
  const outputs = input.outputs;
  const passThreshold = input.passThreshold === void 0 ? 0.95 : numberInRange2(input.passThreshold, "pass_threshold", 0.5, 1);
  const groundingThreshold = input.groundingThreshold === void 0 ? 0.95 : numberInRange2(input.groundingThreshold, "grounding_threshold", 0.5, 1);
  const traceId = input.traceId ? text3(input.traceId, "trace_id", 120) : `trace-${crypto.randomUUID()}`;
  const idempotencyKey3 = key4(input.idempotencyKey);
  return await withLock(workspace, async () => {
    abortIfNeeded4(signal);
    const records = await readRecords4(workspace);
    const operationKey = idempotencyKey3 ? `run:${tenant}:${idempotencyKey3}` : void 0;
    const existing = operationKey && records.find((record2) => record2.idempotencyKeys.includes(operationKey));
    if (existing) return clone4(existing);
    const results = cases.map((item) => {
      const candidate = typeof outputs[item.id] === "string" ? outputs[item.id] : "";
      const pass = candidate === item.expected;
      const grounded = !item.citation || candidate.includes(item.citation);
      return { id: item.id, pass, grounded, review: !pass || !grounded };
    });
    const passRate = results.filter((result) => result.pass).length / results.length;
    const groundingRate = results.filter((result) => result.grounded).length / results.length;
    const review = results.filter((result) => result.review).map((result) => result.id);
    const state = passRate >= passThreshold && groundingRate >= groundingThreshold ? "passed" : "blocked";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: `eval-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      datasetVersion,
      traceId,
      state,
      passRate: Number(passRate.toFixed(3)),
      groundingRate: Number(groundingRate.toFixed(3)),
      passThreshold,
      groundingThreshold,
      review,
      results,
      caseCount: cases.length,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      idempotencyKeys: operationKey ? [operationKey] : []
    };
    records.unshift(record);
    await saveRecords4(workspace, records);
    return clone4(record);
  });
}
async function readEvaluations(workspace, options) {
  const tenant = label4(options.tenant, "tenant");
  const id = options.id ? text3(options.id, "evaluation id", 80) : void 0;
  const records = await readRecords4(workspace);
  return records.filter((record) => record.tenant === tenant && (!id || record.id === id)).map(
    clone4
  );
}

// ../src/features/evaluation.ts
function definition10(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
function compact5(record) {
  return {
    id: record.id,
    tenant: record.tenant,
    datasetVersion: record.datasetVersion,
    traceId: record.traceId,
    state: record.state,
    passRate: record.passRate,
    groundingRate: record.groundingRate,
    passThreshold: record.passThreshold,
    groundingThreshold: record.groundingThreshold,
    caseCount: record.caseCount,
    review: record.review.slice(0, 100),
    results: record.results.slice(0, 100),
    revision: record.revision,
    updatedAt: record.updatedAt
  };
}
function output3(record) {
  return JSON.stringify({
    evaluation: compact5(record),
    releaseBlocked: record.state === "blocked"
  });
}
var evaluation = {
  id: "evaluation-ci",
  register({ tools, prompts }) {
    tools.register(
      definition10(
        "evaluation_gate",
        "Score a versioned dataset and block release when quality or grounding regresses",
        {
          tenant: { type: "string" },
          dataset_version: { type: "string" },
          cases: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                input: { type: "string" },
                expected: { type: "string" },
                citation: { type: "string" }
              },
              required: ["id", "input", "expected"]
            }
          },
          outputs: { type: "object" },
          trace_id: { type: "string" },
          pass_threshold: { type: "number", minimum: 0.5, maximum: 1 },
          grounding_threshold: { type: "number", minimum: 0.5, maximum: 1 },
          idempotency_key: { type: "string" }
        },
        ["tenant", "dataset_version", "cases", "outputs"]
      ),
      async (input, context) => output3(
        await runEvaluation(context.workspace, {
          tenant: String(input.tenant ?? ""),
          datasetVersion: String(input.dataset_version ?? ""),
          cases: Array.isArray(input.cases) ? input.cases : [],
          outputs: input.outputs && typeof input.outputs === "object" ? input.outputs : {},
          traceId: typeof input.trace_id === "string" ? input.trace_id : void 0,
          passThreshold: typeof input.pass_threshold === "number" ? input.pass_threshold : void 0,
          groundingThreshold: typeof input.grounding_threshold === "number" ? input.grounding_threshold : void 0,
          idempotencyKey: typeof input.idempotency_key === "string" ? input.idempotency_key : void 0
        }, context.signal)
      ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 5e4 }
    );
    tools.register(
      definition10("evaluation_status", "Read tenant-scoped evaluation gates and review queues", {
        id: { type: "string" },
        tenant: { type: "string" }
      }, ["tenant"]),
      async (input, context) => {
        const records = await readEvaluations(context.workspace, {
          id: typeof input.id === "string" ? input.id : void 0,
          tenant: String(input.tenant ?? "")
        });
        const evaluations = records.slice(0, 20).map(compact5);
        return JSON.stringify({ evaluation: evaluations[0] ?? null, evaluations });
      }
    );
    prompts.register({
      id: "evaluation-ci",
      title: "Evaluation CI and release gates",
      priority: 41,
      content: "Treat evaluation as a release gate, not a claim of quality. Run a versioned dataset against a bounded candidate output set, score exact correctness and citation grounding, preserve every failed case in the review queue, and block promotion when thresholds are missed. Keep datasets tenant-scoped and trace-linked; do not silently drop flaky, negative, safety, latency, or cost cases. Human review may resolve a case outside this deterministic gate, but it must leave explicit evidence before release."
    });
  }
};

// ../src/security_boundary.ts
var MAX_AUDIT = 200;
var MAX_SCOPE = 120;
var MAX_TENANT3 = 240;
var MAX_TEXT2 = 12e3;
var locks2 = /* @__PURE__ */ new Map();
function value(input, name, max) {
  const result = String(input ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} \u65E0\u6548`);
  }
  return result;
}
function isPrivateIpv4(host) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
}
function isPrivateHost(host) {
  const normalized = host.toLowerCase().replace(/[\[\]]/g, "");
  if (isPrivateIpv4(normalized)) return true;
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}
function safeUrl2(raw) {
  let url;
  try {
    url = new URL(value(raw, "url", 2e3));
  } catch {
    throw new Error("url \u65E0\u6548");
  }
  if (url.username || url.password) throw new Error("URL \u4E0D\u5F97\u5305\u542B\u51ED\u636E");
  const normalizedHost = url.hostname.toLowerCase().replace(/[\[\]]/g, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(normalizedHost);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("\u51FA\u53E3\u53EA\u5141\u8BB8 HTTPS \u6216 localhost HTTP");
  }
  if (!local && isPrivateHost(normalizedHost)) throw new Error("\u51FA\u53E3\u5730\u5740\u547D\u4E2D SSRF \u79C1\u6709\u7F51\u6BB5");
  return { url, host: normalizedHost };
}
function redactSecrets(raw) {
  const text4 = String(raw ?? "").slice(0, MAX_TEXT2);
  return text4.replace(/(?:sk-[A-Za-z0-9_-]+|api[_-]?key\s*[:=]\s*\S+)/gi, "[REDACTED]").replace(
    /(?:bearer\s+|token\s*[:=]\s*|password\s*[:=]\s*|secret\s*[:=]\s*)\S+/gi,
    "[REDACTED]"
  );
}
async function auditPath(workspace) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const key5 = [...new Uint8Array(digest)].slice(0, 12).map(
    (item) => item.toString(16).padStart(2, "0")
  ).join("");
  return `${appDataDir()}/security/${key5}.json`;
}
async function readAudit(workspace) {
  try {
    const value2 = JSON.parse(await readUtf8(await auditPath(workspace)));
    if (!Array.isArray(value2) || value2.length > MAX_AUDIT) {
      throw new Error("security audit \u5B58\u50A8\u65E0\u6548");
    }
    return value2;
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}
async function withLock2(workspace, operation) {
  const previous = locks2.get(workspace) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve4) => release = resolve4);
  locks2.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks2.get(workspace) === current) locks2.delete(workspace);
  }
}
async function checkSecurityBoundary(workspace, input, principal, signal) {
  if (signal?.aborted) throw new DOMException("Security check cancelled", "AbortError");
  const scope = value(input.scope, "scope", MAX_SCOPE);
  const expectedTenant = input.tenant ? value(input.tenant, "tenant", MAX_TENANT3) : void 0;
  const subject = value(principal.subject ?? principal.id, "subject", 240);
  const tenant = value(principal.tenant ?? "local", "tenant", MAX_TENANT3);
  let host;
  let allowed = true;
  let reason = "allowed";
  try {
    if (expectedTenant && expectedTenant !== tenant) throw new Error("tenant \u4E0D\u5339\u914D");
    if (principal.expiresAt <= Date.now()) throw new Error("identity \u5DF2\u8FC7\u671F");
    if (!principal.scopes.has(scope)) throw new Error("identity scope \u4E0D\u8DB3");
    host = safeUrl2(input.url).host;
  } catch (error) {
    allowed = false;
    reason = error instanceof Error ? error.message : String(error);
  }
  const audit = {
    action: scope,
    allowed,
    reason,
    subject,
    tenant,
    host,
    at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withLock2(workspace, async () => {
    const records = await readAudit(workspace);
    records.push(audit);
    await writeJsonAtomic(await auditPath(workspace), records.slice(-MAX_AUDIT));
  });
  if (!allowed) throw new Error(`security boundary denied: ${reason}`);
  return {
    audit,
    redactedText: input.text === void 0 ? void 0 : redactSecrets(input.text)
  };
}
async function readSecurityAudit(workspace, limit = 50) {
  const records = await readAudit(workspace);
  return records.slice(-Math.max(1, Math.min(MAX_AUDIT, Math.trunc(limit))));
}

// ../src/features/security_boundary.ts
function definition11(name, description, properties, required) {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } }
  };
}
var securityBoundary = {
  id: "security-boundary",
  register({ tools, prompts }) {
    tools.register(
      definition11(
        "security_boundary",
        "Check expiring identity, tenant scope, safe HTTPS egress, SSRF controls, and redact secrets",
        {
          scope: { type: "string" },
          url: { type: "string" },
          tenant: { type: "string" },
          text: { type: "string" }
        },
        ["scope", "url"]
      ),
      async (input, context) => {
        if (!context.principal) throw new Error("security boundary requires an identity principal");
        const result = await checkSecurityBoundary(
          context.workspace,
          {
            scope: String(input.scope ?? ""),
            url: String(input.url ?? ""),
            tenant: typeof input.tenant === "string" ? input.tenant : void 0,
            text: typeof input.text === "string" ? input.text : void 0
          },
          context.principal,
          context.signal
        );
        return JSON.stringify({ security: result.audit, redactedText: result.redactedText });
      },
      { risk: "external", scopes: ["external"], maxOutput: 2e4 }
    );
    tools.register(
      definition11("security_audit", "Read recent security allow and deny decisions", {
        limit: { type: "integer", minimum: 1, maximum: 50 }
      }, []),
      async (input, context) => JSON.stringify({
        audit: await readSecurityAudit(
          context.workspace,
          typeof input.limit === "number" ? input.limit : 50
        )
      })
    );
    prompts.register({
      id: "security-boundary",
      title: "Identity, sandbox, egress, and DLP",
      priority: 42,
      content: "Treat identity as short-lived and least-privileged: require the needed scope and matching tenant before an external action. Keep paths inside the active workspace, allow only HTTPS or localhost HTTP, reject credentials and private SSRF destinations, and redact API keys, bearer tokens, passwords, and secrets before returning or logging text. Every allow and deny decision must be auditable; denial is safer than silently widening policy."
    });
  }
};

// ../src/mod.ts
var harness = new AgentRuntime([
  diagnostics,
  runtimeLimits,
  pdfReader,
  coreTools,
  productivity,
  orchestration,
  integrations,
  imageGeneration,
  toolPolicy,
  taskState,
  workerQueue,
  handoff,
  memoryRag,
  research,
  evaluation,
  securityBoundary,
  scheduling
]);
var runAgent = harness.run.bind(harness);
async function agentLoop(query, onEvent = () => {
}, model, history = [], permissionMode = "ask", signal, onHook = () => {
}, providerId, budget, principal) {
  return await harness.run({
    query,
    providerId,
    model,
    history,
    permissionMode,
    signal,
    budget,
    principal,
    onEvent(event) {
      if (event.type === "tool") {
        onEvent({
          type: "tool",
          name: event.name,
          input: event.input ?? "",
          output: event.output ?? "",
          traceId: event.traceId,
          spanId: event.spanId,
          parentSpanId: event.parentSpanId,
          durationMs: event.durationMs,
          traceStatus: event.traceStatus
        });
      } else onHook(event);
    }
  });
}

// assets.ts
import { readFile as readFile6 } from "node:fs/promises";
import { join as join2 } from "node:path";
var files = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" },
  "/settings.css": { file: "settings.css", contentType: "text/css; charset=utf-8" },
  "/stream.css": { file: "stream.css", contentType: "text/css; charset=utf-8" },
  "/developer.css": { file: "developer.css", contentType: "text/css; charset=utf-8" },
  "/todo.css": { file: "todo.css", contentType: "text/css; charset=utf-8" },
  "/subagent.css": { file: "subagent.css", contentType: "text/css; charset=utf-8" },
  "/skill.css": { file: "skill.css", contentType: "text/css; charset=utf-8" },
  "/layout.css": { file: "layout.css", contentType: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/app-icon.png": { file: "app-icon.png", contentType: "image/png" }
};
async function loadDesktopAssets(root) {
  const assets = /* @__PURE__ */ new Map();
  for (const [url, asset] of Object.entries(files)) {
    assets.set(url, { body: await readFile6(join2(root, asset.file)), contentType: asset.contentType });
  }
  return assets;
}

// desktop-assets.ts
async function desktopAssets(rendererRoot) {
  return await loadDesktopAssets(rendererRoot);
}

// ../desktop/services/chat.ts
async function runChat(body) {
  if (!body.message?.trim()) throw new Error("message is required");
  const events = [];
  let budget;
  let trace;
  let task;
  let worker;
  let handoff2;
  let research2;
  let evaluation2;
  const answer = await agentLoop(
    body.message,
    (event) => events.push(event),
    body.model,
    body.history ?? [],
    body.permissionMode ?? "ask",
    void 0,
    (event) => {
      if (event.name === "RunUsage") {
        try {
          budget = JSON.parse(event.detail ?? "");
        } catch {
        }
      }
      if (event.name === "TraceSummary") {
        try {
          trace = JSON.parse(event.detail ?? "");
        } catch {
        }
      }
      if (event.name === "TaskState") {
        try {
          task = JSON.parse(event.detail ?? "{}").task ?? void 0;
        } catch {
        }
      }
      if (event.name === "WorkerState") {
        try {
          worker = JSON.parse(event.detail ?? "{}").worker ?? void 0;
        } catch {
        }
      }
      if (event.name === "HandoffState") {
        try {
          handoff2 = JSON.parse(event.detail ?? "{}").handoff ?? void 0;
        } catch {
        }
      }
      if (event.name === "ResearchState") {
        try {
          research2 = JSON.parse(event.detail ?? "{}").research ?? void 0;
        } catch {
        }
      }
      if (event.name === "EvaluationState") {
        try {
          evaluation2 = JSON.parse(event.detail ?? "{}").evaluation ?? void 0;
        } catch {
        }
      }
    },
    body.providerId
  );
  return { answer, events, budget, trace, task, worker, handoff: handoff2, research: research2, evaluation: evaluation2 };
}
function createChatStream(body) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let streamClosed = false;
  return new ReadableStream({
    start(controller) {
      const emit = (data) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}
`));
        } catch {
          streamClosed = true;
          abortController.abort();
        }
      };
      const close = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
        }
      };
      emit({ type: "status", message: "\u6B63\u5728\u5206\u6790\u4EFB\u52A1\u2026" });
      agentLoop(
        body.message ?? "",
        (event) => emit({ type: "tool", event }),
        body.model,
        body.history ?? [],
        body.permissionMode ?? "ask",
        abortController.signal,
        (event) => {
          if (event.name === "RunUsage") {
            try {
              emit({ type: "budget", usage: JSON.parse(event.detail ?? "") });
            } catch {
            }
          }
          if (event.name === "TraceSummary") {
            try {
              emit({ type: "trace", summary: JSON.parse(event.detail ?? "") });
            } catch {
            }
          }
          if (event.name === "TaskState") {
            try {
              emit({ type: "task", task: JSON.parse(event.detail ?? "{}").task });
            } catch {
            }
          }
          if (event.name === "WorkerState") {
            try {
              emit({ type: "worker", worker: JSON.parse(event.detail ?? "{}").worker ?? null });
            } catch {
            }
          }
          if (event.name === "HandoffState") {
            try {
              emit({ type: "handoff", handoff: JSON.parse(event.detail ?? "{}").handoff ?? null });
            } catch {
            }
          }
          if (event.name === "ResearchState") {
            try {
              emit({
                type: "research",
                research: JSON.parse(event.detail ?? "{}").research ?? null
              });
            } catch {
            }
          }
          if (event.name === "EvaluationState") {
            try {
              emit({
                type: "evaluation",
                evaluation: JSON.parse(event.detail ?? "{}").evaluation ?? null
              });
            } catch {
            }
          }
          if (body.developerMode && event.name !== "RunUsage" && event.name !== "TraceSummary" && event.name !== "TaskState" && event.name !== "WorkerState" && event.name !== "HandoffState" && event.name !== "ResearchState" && event.name !== "EvaluationState") {
            emit({ type: "hook", event });
          }
        },
        body.providerId
      ).then((answer) => {
        emit({ type: "status", message: "\u6B63\u5728\u7EC4\u7EC7\u7B54\u6848\u2026" });
        emit({ type: "answer", answer });
        emit({ type: "done" });
        close();
      }).catch((error) => {
        emit({ type: "error", error: error instanceof Error ? error.message : String(error) });
        close();
      });
    },
    cancel() {
      streamClosed = true;
      abortController.abort();
    }
  });
}

// ../desktop/services/workspace.ts
import { readdir as readdir2, readFile as readFile7, realpath, stat as stat4 } from "node:fs/promises";
import { extname, isAbsolute as isAbsolute3, relative as relative3, resolve as resolve3 } from "node:path";
var TREE_MAX_DEPTH = 6;
var TREE_MAX_ENTRIES = 900;
var TREE_IGNORED_NAMES = /* @__PURE__ */ new Set([
  ".git",
  ".DS_Store",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo"
]);
function joinWorkspacePath(base, name) {
  return base.endsWith("/") || base.endsWith("\\") ? `${base}${name}` : `${base}/${name}`;
}
function childRelativePath(parent, name) {
  return parent ? `${parent}/${name}` : name;
}
async function readWorkspaceTree() {
  const workspace = await realpath(await getWorkspace());
  const counter = { count: 0, truncated: false };
  const readDirectory = async (absolutePath, relativePath, depth) => {
    if (depth >= TREE_MAX_DEPTH || counter.count >= TREE_MAX_ENTRIES) {
      counter.truncated = true;
      return [];
    }
    let entries = [];
    try {
      entries = (await readdir2(absolutePath, { withFileTypes: true })).filter(
        (entry) => !TREE_IGNORED_NAMES.has(entry.name)
      );
    } catch {
      return [];
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });
    const nodes = [];
    for (const entry of entries) {
      if (counter.count >= TREE_MAX_ENTRIES) {
        counter.truncated = true;
        break;
      }
      counter.count++;
      const path2 = childRelativePath(relativePath, entry.name);
      const node = {
        name: entry.name,
        path: path2,
        type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file"
      };
      if (entry.isDirectory()) {
        node.children = await readDirectory(
          joinWorkspacePath(absolutePath, entry.name),
          path2,
          depth + 1
        );
        node.truncated = counter.truncated && depth + 1 >= TREE_MAX_DEPTH;
      }
      nodes.push(node);
    }
    return nodes;
  };
  return {
    workspace,
    rootName: workspace.split(/[\\/]/).filter(Boolean).pop() || workspace,
    entries: await readDirectory(workspace, "", 0),
    truncated: counter.truncated,
    limit: TREE_MAX_ENTRIES
  };
}
async function openWorkspaceFile(path2) {
  const workspace = await getWorkspace();
  const root = await realpath(workspace);
  const target = await realpath(
    path2.startsWith("/") || isWindows && /^[A-Za-z]:[\\/]/.test(path2) ? path2 : joinWorkspacePath(root, path2)
  );
  if (target !== root && !target.startsWith(`${root}/`) && !target.startsWith(`${root}\\`)) {
    throw new Error("\u6587\u4EF6\u4E0D\u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u4E2D");
  }
  const command = process.platform === "darwin" ? "open" : isWindows ? "explorer.exe" : "xdg-open";
  const result = await runCommand(command, [target]);
  if (!result.success) throw new Error(result.stderr || "\u65E0\u6CD5\u6253\u5F00\u6587\u4EF6");
}
var IMAGE_CONTENT_TYPES = /* @__PURE__ */ new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
async function readWorkspaceImage(path2) {
  if (!path2 || isAbsolute3(path2)) throw new Error("\u56FE\u7247\u8DEF\u5F84\u5FC5\u987B\u662F\u5DE5\u4F5C\u533A\u76F8\u5BF9\u8DEF\u5F84");
  const workspace = await realpath(await getWorkspace());
  const target = resolve3(workspace, path2);
  const rel = relative3(workspace, target);
  if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("\u56FE\u7247\u4E0D\u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u4E2D");
  }
  const generatedPrefix = `.ai-agent${process.platform === "win32" ? "\\" : "/"}generated-images`;
  if (rel !== generatedPrefix && !rel.startsWith(`${generatedPrefix}${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("\u4EC5\u5141\u8BB8\u9884\u89C8 Agent \u751F\u6210\u7684\u56FE\u7247");
  }
  const actual = await realpath(target);
  if (actual !== workspace && !actual.startsWith(`${workspace}/`) && !actual.startsWith(`${workspace}\\`)) throw new Error("\u56FE\u7247\u4E0D\u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u4E2D");
  const contentType = IMAGE_CONTENT_TYPES.get(extname(actual).toLowerCase());
  if (!contentType) throw new Error("\u4E0D\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F");
  const info = await stat4(actual);
  if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("\u56FE\u7247\u6587\u4EF6\u65E0\u6548\u6216\u8D85\u8FC7 20 MB");
  return { body: await readFile7(actual), contentType };
}

// ../desktop/services/git.ts
import { readFile as readFile8, realpath as realpath2, stat as stat5 } from "node:fs/promises";
function classifyGitStatus(code) {
  if (code.includes("?")) return "untracked";
  if (code.includes("R")) return "renamed";
  if (code.includes("D")) return "deleted";
  if (code.includes("A")) return "added";
  if (code.includes("M")) return "modified";
  return "changed";
}
async function runGit(workspace, args) {
  const command = isWindows ? "git" : "/usr/bin/git";
  const result = await runCommand(command, args, { cwd: workspace });
  return {
    success: result.success,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}
async function countSmallTextFileLines(path2) {
  try {
    const info = await stat5(path2);
    if (!info.isFile() || info.size > 3e5) return 0;
    const content = await readFile8(path2, "utf8");
    if (!content || content.includes("\0")) return 0;
    return content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
  } catch {
    return 0;
  }
}
async function includeUntrackedFileStats(workspace, changes, stats) {
  for (const item of changes) {
    if (item.kind === "untracked") {
      stats.additions += await countSmallTextFileLines(joinWorkspacePath(workspace, item.path));
    }
  }
}
async function readWorkspaceGit() {
  const workspace = await realpath2(await getWorkspace());
  const root = await runGit(workspace, ["rev-parse", "--show-toplevel"]);
  if (!root.success) {
    return {
      workspace,
      isRepo: false,
      stats: { changedFiles: 0, additions: 0, deletions: 0 },
      changes: [],
      commits: []
    };
  }
  const status = await runGit(workspace, ["status", "--short", "--branch", "-uall"]);
  const lines = status.stdout.split("\n").filter(Boolean);
  const branchDetail = lines[0]?.replace(/^##\s*/, "") || "detached";
  const branch = branchDetail.split("...")[0].replace(/\s+\[.*\]$/, "");
  const aheadBehind = branchDetail.match(/\[(.+)\]/)?.[1];
  const changes = lines.slice(1).map((line) => {
    const code = line.slice(0, 2).trim() || "??";
    const displayPath = line.slice(3).trim();
    const path2 = displayPath.includes(" -> ") ? displayPath.split(" -> ").pop() || displayPath : displayPath;
    return { code, path: path2, displayPath, kind: classifyGitStatus(code) };
  });
  const numstat = await runGit(workspace, ["diff", "--numstat", "HEAD", "--"]);
  const stats = numstat.stdout.split("\n").filter(Boolean).reduce(
    (summary, line) => {
      const [additions, deletions] = line.split(/\s+/);
      const add = Number(additions);
      const del = Number(deletions);
      summary.additions += Number.isFinite(add) ? add : 0;
      summary.deletions += Number.isFinite(del) ? del : 0;
      return summary;
    },
    { changedFiles: changes.length, additions: 0, deletions: 0 }
  );
  await includeUntrackedFileStats(workspace, changes, stats);
  const head = await runGit(workspace, ["rev-parse", "--short", "HEAD"]);
  const log = await runGit(workspace, [
    "log",
    "-n",
    "8",
    "--pretty=format:%h%x09%cr%x09%an%x09%s"
  ]);
  const commits = log.success ? log.stdout.split("\n").filter(Boolean).map((line) => {
    const [hash = "", relativeDate = "", author = "", ...subject] = line.split("	");
    return { hash, relativeDate, author, subject: subject.join("	") };
  }) : [];
  return {
    workspace,
    isRepo: true,
    root: root.stdout,
    branch,
    branchDetail,
    shortHead: head.success ? head.stdout : void 0,
    aheadBehind,
    stats,
    changes,
    commits
  };
}

// ../desktop/services/updater.ts
import { mkdtemp, realpath as realpath3, stat as stat6 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join3 } from "node:path";
import { spawn as spawn3 } from "node:child_process";
var APP_VERSION = "1.0.1";
var UPDATE_CHECK_TIMEOUT_MS = 8e3;
var UPDATE_DOWNLOAD_TIMEOUT_MS = 12e4;
function extractVersion(value2) {
  return value2.match(/\d+(?:\.\d+){1,3}/)?.[0] ?? "";
}
function compareVersions(left, right) {
  const parse = (value2) => extractVersion(value2).split(".").map(Number).filter(Number.isFinite);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
function selectUpdateDownloadUrl(manifest) {
  if (manifest.downloadUrl) return manifest.downloadUrl;
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  return assets.filter((asset) => asset.browser_download_url && asset.state !== "deleted").filter((asset) => (asset.name ?? "").toLowerCase().endsWith(".zip")).map((asset) => {
    const name = (asset.name ?? "").toLowerCase();
    let score = 0;
    if (name.includes("aiagent") || name.includes("ai-agent")) score += 4;
    if (name.includes("macos") || name.includes("darwin")) score += 3;
    if (name.includes("arm64") || name.includes("aarch64")) score += 3;
    if (name.includes("x64") || name.includes("x86_64")) score -= 1;
    return { asset, score };
  }).sort((a, b) => b.score - a.score)[0]?.asset.browser_download_url;
}
function validateUpdateDownloadUrl(downloadUrl) {
  const parsed = new URL(downloadUrl);
  const isLocalDev = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(isLocalDev && parsed.protocol === "http:")) {
    throw new Error("\u66F4\u65B0\u5305\u4E0B\u8F7D\u5730\u5740\u5FC5\u987B\u4F7F\u7528 HTTPS\uFF1B\u672C\u5730\u5F00\u53D1\u53EA\u5141\u8BB8 localhost HTTP");
  }
  if (!parsed.pathname.toLowerCase().endsWith(".zip")) {
    throw new Error("\u5F53\u524D\u81EA\u52A8\u66F4\u65B0\u53EA\u652F\u6301 .zip \u66F4\u65B0\u5305");
  }
}
async function currentAppBundlePath() {
  let path2 = await realpath3(process.execPath);
  while (path2 && path2 !== "/") {
    if (path2.endsWith(".app") && (await stat6(path2)).isDirectory()) return path2;
    const trimmed = path2.replace(/\/+$/, "");
    const slash = trimmed.lastIndexOf("/");
    path2 = slash <= 0 ? "/" : trimmed.slice(0, slash);
  }
  return void 0;
}
function shellQuote(value2) {
  return `'${value2.replaceAll("'", "'\\''")}'`;
}
async function downloadUpdateArchive(downloadUrl, archivePath) {
  validateUpdateDownloadUrl(downloadUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(downloadUrl, {
      headers: { "accept": "application/octet-stream" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`\u66F4\u65B0\u5305\u4E0B\u8F7D\u5931\u8D25\uFF1AHTTP ${response.status}`);
    await writeBufferAtomic(archivePath, Buffer.from(await response.arrayBuffer()));
  } finally {
    clearTimeout(timeout);
  }
}
async function checkForUpdate() {
  const settings = await getPublicSettings();
  const updateUrl = settings.update.updateUrl.trim();
  if (!updateUrl) {
    return {
      configured: false,
      currentVersion: APP_VERSION,
      updateAvailable: false,
      message: "\u672A\u914D\u7F6E\u66F4\u65B0\u6E90\uFF1B\u53EF\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 HTTPS manifest \u6216 GitHub release API URL"
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(updateUrl, {
      headers: { "accept": "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`\u66F4\u65B0\u6E90\u8FD4\u56DE HTTP ${response.status}`);
    const manifest = await response.json();
    const latestVersion = extractVersion(String(manifest.version ?? manifest.tag_name ?? ""));
    if (!latestVersion) throw new Error("\u66F4\u65B0\u6E90\u7F3A\u5C11 version \u6216 tag_name \u5B57\u6BB5");
    const releaseUrl = manifest.releaseUrl ?? manifest.html_url ?? manifest.url;
    const downloadUrl = selectUpdateDownloadUrl(manifest);
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    await saveUpdateSettings({ lastCheckAt: checkedAt, latestVersion, releaseUrl });
    const updateAvailable = compareVersions(latestVersion, APP_VERSION) > 0;
    return {
      configured: true,
      currentVersion: APP_VERSION,
      latestVersion,
      updateAvailable,
      releaseUrl,
      downloadUrl,
      notes: manifest.notes ?? manifest.body,
      checkedAt,
      message: updateAvailable ? `\u53D1\u73B0\u65B0\u7248\u672C ${latestVersion}` : "\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C"
    };
  } finally {
    clearTimeout(timeout);
  }
}
async function installUpdateAndRestart() {
  if (!isMacOS) throw new Error("\u5F53\u524D\u81EA\u52A8\u5B89\u88C5\u66F4\u65B0\u4EC5\u652F\u6301 macOS");
  const update = await checkForUpdate();
  if (!update.updateAvailable || !update.latestVersion) {
    throw new Error("\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C\uFF0C\u65E0\u9700\u66F4\u65B0");
  }
  if (!update.downloadUrl) {
    throw new Error("GitHub Release \u672A\u627E\u5230\u53EF\u5B89\u88C5\u7684 macOS arm64 .zip \u8D44\u4EA7");
  }
  const appPath = await currentAppBundlePath();
  if (!appPath) {
    throw new Error("\u5F00\u53D1\u6A21\u5F0F\u4E0D\u652F\u6301\u81EA\u52A8\u66FF\u6362\u5E94\u7528\uFF1B\u8BF7\u7528\u6253\u5305\u540E\u7684 AI Agent.app \u6D4B\u8BD5");
  }
  const appParent = appPath.slice(0, appPath.lastIndexOf("/"));
  const tempDir = await mkdtemp(join3(tmpdir(), "ai-agent-update-"));
  const archivePath = `${tempDir}/AIAgent-${update.latestVersion}.zip`;
  const scriptPath = `${tempDir}/install-update.sh`;
  const backupPath = `${appPath}.bak-${Date.now()}`;
  await downloadUpdateArchive(update.downloadUrl, archivePath);
  const script = `#!/bin/sh
set -eu
APP_PATH=${shellQuote(appPath)}
APP_PARENT=${shellQuote(appParent)}
ARCHIVE_PATH=${shellQuote(archivePath)}
BACKUP_PATH=${shellQuote(backupPath)}
TEMP_DIR=${shellQuote(tempDir)}
APP_PID=${process.pid}
while kill -0 "$APP_PID" 2>/dev/null; do sleep 0.2; done
rm -rf "$BACKUP_PATH"
if [ -d "$APP_PATH" ]; then mv "$APP_PATH" "$BACKUP_PATH"; fi
/usr/bin/ditto -x -k "$ARCHIVE_PATH" "$APP_PARENT"
if [ ! -d "$APP_PATH" ]; then
  if [ -d "$BACKUP_PATH" ]; then mv "$BACKUP_PATH" "$APP_PATH"; fi
  exit 1
fi
rm -rf "$BACKUP_PATH"
/usr/bin/open "$APP_PATH"
rm -rf "$TEMP_DIR"
`;
  await writeTextAtomic(scriptPath, script);
  spawn3("/bin/sh", [scriptPath], { detached: true, stdio: "ignore" }).unref();
  setTimeout(() => process.exit(0), 300);
  return {
    ok: true,
    version: update.latestVersion,
    message: `\u5DF2\u4E0B\u8F7D ${update.latestVersion}\uFF0C\u5E94\u7528\u5373\u5C06\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00`
  };
}

// ../desktop/services/acceptance.ts
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function assertEquals(actual, expected, message = "values differ") {
  if (Object.is(actual, expected)) return;
  throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
async function expectBudgetError(action, kind2) {
  let thrown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof BudgetExceededError, `expected ${kind2} budget error`);
  assertEquals(thrown.kind, kind2);
}
var fakeConfig = {
  id: "fake",
  name: "Fake Provider",
  protocol: "openai",
  apiKey: "test-only",
  baseUrl: "https://fake.invalid",
  model: "fake-model"
};
var echoDefinition = {
  type: "function",
  function: {
    name: "test_echo",
    description: "Return a small test value",
    parameters: { type: "object", properties: {}, required: [] }
  }
};
var echoFeature = {
  id: "test-echo",
  register({ tools }) {
    tools.register(echoDefinition, async (input, context) => {
      assert(context.budget instanceof RuntimeBudget, "tool context must receive a budget");
      return `echo:${String(input.value ?? "ok")}`;
    });
  }
};
function toolResponse(id = "call-1") {
  return {
    choices: [{
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id,
          type: "function",
          function: { name: "test_echo", arguments: '{"value":"ok"}' }
        }]
      },
      finish_reason: "tool_calls"
    }]
  };
}
function textResponse(content) {
  return { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] };
}
function createRuntime(factory) {
  let callCount = 0;
  const provider = {
    id: "fake",
    async createChatCompletion(_config, _messages, _tools, _signal) {
      const response = factory(callCount);
      callCount++;
      return response;
    }
  };
  return {
    runtime: new AgentRuntime([echoFeature], {
      resolveProviderConfig: async () => fakeConfig,
      getModelProvider: () => provider
    }),
    calls: () => callCount
  };
}
function runOptions(budget) {
  return {
    query: "test bounded runtime",
    workspace: process.cwd(),
    permissionMode: "full",
    budget
  };
}
var runtimeBudgetAcceptanceCases = [
  {
    id: "21test-budget-child",
    title: "\u5B50\u9884\u7B97\u4F20\u64AD\u4E0E\u8BB0\u8D26",
    run() {
      const parent = new RuntimeBudget({ iterations: 3, toolCalls: 3, outputChars: 20, cost: 2 });
      const child = parent.child({ iterations: 1, toolCalls: 2, outputChars: 10, cost: 1 });
      child.consume("iterations");
      child.consume("toolCalls", 2);
      assertEquals(parent.used.iterations, 1);
      assertEquals(parent.used.toolCalls, 2);
      assertEquals(child.remaining().toolCalls, 0);
    }
  },
  {
    id: "21test-agent-loop",
    title: "Agent Loop \u6B63\u5E38\u5B8C\u6210\u5E76\u53D1\u51FA\u9884\u7B97\u8BC1\u636E",
    async run() {
      const { runtime, calls } = createRuntime(
        (call) => call === 0 ? toolResponse() : textResponse("done")
      );
      const hooks = [];
      let toolRuns = 0;
      const result = await runtime.run({
        ...runOptions({ iterations: 2, toolCalls: 1, outputChars: 100, cost: 2 }),
        onEvent(event) {
          if (event.type === "hook") hooks.push(event.name);
          if (event.type === "tool") toolRuns++;
        }
      });
      assertEquals(result, "done");
      assertEquals(calls(), 2);
      assertEquals(toolRuns, 1);
      assert(hooks.includes("RunBudget"), "RunBudget hook missing");
      assert(hooks.includes("RunUsage"), "RunUsage hook missing");
      assert(hooks.includes("Stop"), "Stop hook missing");
    }
  },
  {
    id: "21test-tool-limit",
    title: "\u5DE5\u5177\u8C03\u7528\u9884\u7B97\u8D85\u9650\u524D\u505C\u6B62",
    async run() {
      const { runtime, calls } = createRuntime((call) => toolResponse(`call-${call}`));
      const hooks = [];
      let toolRuns = 0;
      await expectBudgetError(
        () => runtime.run({
          ...runOptions({ iterations: 10, toolCalls: 1, outputChars: 100, cost: 10 }),
          onEvent(event) {
            if (event.type === "hook") hooks.push(event.name);
            if (event.type === "tool") toolRuns++;
          }
        }),
        "toolCalls"
      );
      assertEquals(calls(), 2);
      assertEquals(toolRuns, 1);
      assert(hooks.includes("BudgetExceeded"), "BudgetExceeded hook missing");
    }
  },
  {
    id: "21test-output-cost",
    title: "\u8F93\u51FA\u91CF\u548C Provider \u6210\u672C\u9884\u7B97",
    async run() {
      const outputRuntime = createRuntime(() => textResponse("1234"));
      await expectBudgetError(
        () => outputRuntime.runtime.run(runOptions({
          iterations: 1,
          toolCalls: 1,
          outputChars: 3,
          cost: 1
        })),
        "outputChars"
      );
      assertEquals(outputRuntime.calls(), 1);
      const costRuntime = createRuntime(() => textResponse("never reached"));
      await expectBudgetError(
        () => costRuntime.runtime.run(runOptions({
          iterations: 1,
          toolCalls: 1,
          outputChars: 100,
          cost: 0
        })),
        "cost"
      );
      assertEquals(costRuntime.calls(), 0);
    }
  },
  {
    id: "21test-iteration-cancel",
    title: "\u8FED\u4EE3\u9884\u7B97\u548C AbortSignal \u53D6\u6D88",
    async run() {
      const { runtime, calls } = createRuntime((call) => toolResponse(`call-${call}`));
      await expectBudgetError(
        () => runtime.run(runOptions({ iterations: 1, toolCalls: 10, outputChars: 100, cost: 10 })),
        "iterations"
      );
      assertEquals(calls(), 1);
      const cancelled = new AbortController();
      cancelled.abort();
      const cancelledRuntime = createRuntime(() => textResponse("never reached"));
      let thrown;
      try {
        await cancelledRuntime.runtime.run({ ...runOptions({}), signal: cancelled.signal });
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof DOMException && thrown.name === "AbortError", "cancel must abort");
      assertEquals(cancelledRuntime.calls(), 0);
    }
  }
];
async function runRuntimeBudgetAcceptance() {
  const results = [];
  for (const acceptanceCase of runtimeBudgetAcceptanceCases) {
    const startedAt = performance.now();
    try {
      await acceptanceCase.run();
      results.push({
        id: acceptanceCase.id,
        title: acceptanceCase.title,
        status: "passed",
        durationMs: Math.round(performance.now() - startedAt)
      });
    } catch (error) {
      results.push({
        id: acceptanceCase.id,
        title: acceptanceCase.title,
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const passed = results.filter((result) => result.status === "passed").length;
  return {
    suite: "21test-runtime-budget",
    ok: passed === results.length,
    passed,
    failed: results.length - passed,
    results
  };
}

// ../desktop/services/balance.ts
function isDeepSeek(config) {
  return `${config.id} ${config.name} ${config.baseUrl}`.toLowerCase().includes("deepseek");
}
function asBalanceInfo(value2) {
  if (!value2 || typeof value2 !== "object") return void 0;
  const raw = value2;
  const currency = raw.currency === "CNY" || raw.currency === "USD" ? raw.currency : void 0;
  if (!currency) return void 0;
  const totalBalance = String(raw.total_balance ?? "").trim();
  const grantedBalance = String(raw.granted_balance ?? "").trim();
  const toppedUpBalance = String(raw.topped_up_balance ?? "").trim();
  if (!totalBalance || !Number.isFinite(Number(totalBalance))) return void 0;
  return { currency, totalBalance, grantedBalance, toppedUpBalance };
}
async function readProviderBalance(providerId) {
  const config = await resolveProviderConfig(providerId);
  if (!isDeepSeek(config)) return { supported: false, providerId: config.id };
  const balanceBaseUrl = config.baseUrl.replace(/\/v1\/?$/, "");
  const response = await fetch(`${balanceBaseUrl}/user/balance`, {
    headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" }
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF08${response.status}\uFF09\uFF1A${detail}`);
  }
  const payload = await response.json();
  const rawBalances = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
  return {
    supported: true,
    providerId: config.id,
    isAvailable: payload.is_available === true,
    balanceInfos: rawBalances.flatMap((item) => {
      const balance = asBalanceInfo(item);
      return balance ? [balance] : [];
    })
  };
}

// ../desktop/services/lesson_tests.ts
function assert2(condition, message) {
  if (!condition) throw new Error(message);
}
function assertEquals2(actual, expected, message = "values differ") {
  if (Object.is(actual, expected)) return;
  throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertTools(...names) {
  const available = new Set(harness.tools.names());
  const missing = names.filter((name) => !available.has(name));
  assert2(!missing.length, `missing tools: ${missing.join(", ")}`);
}
function lesson(number, title, description, run) {
  return {
    lesson: number,
    id: `21test-${String(number).padStart(2, "0")}`,
    title,
    description,
    run
  };
}
var lessonTestCases = [
  lesson(1, "Agent Loop", "\u9A8C\u8BC1\u751F\u4EA7 Harness \u66B4\u9732\u5355\u4E00 AgentRuntime \u5165\u53E3\u3002", () => {
    assert2(typeof harness.run === "function", "AgentRuntime.run is unavailable");
  }),
  lesson(2, "Tool Use", "\u9A8C\u8BC1\u6838\u5FC3\u6587\u4EF6\u548C Shell \u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("bash", "read_file", "write_file", "edit_file");
  }),
  lesson(3, "Permission", "\u9A8C\u8BC1\u5371\u9669 Shell \u547D\u4EE4\u5728 auto \u6A21\u5F0F\u4E0B\u88AB\u62D2\u7EDD\u3002", async () => {
    let denied = false;
    try {
      await authorize({ name: "bash", input: { command: "rm -rf /" } }, "auto");
    } catch {
      denied = true;
    }
    assert2(denied, "dangerous command was not denied");
  }),
  lesson(4, "Hooks", "\u9A8C\u8BC1 Hook \u6240\u9700\u7684\u7A33\u5B9A\u7CFB\u7EDF\u63D0\u793A\u533A\u6BB5\u5DF2\u7EC4\u88C5\u3002", () => {
    const prompt = harness.prompts.build(process.cwd());
    const ids = prompt.sections.map((section) => section.id);
    assertEquals2(new Set(ids).size, ids.length, "prompt section ids must be unique");
    assert2(ids.includes("contract"), "contract prompt section missing");
  }),
  lesson(5, "TodoWrite", "\u9A8C\u8BC1\u4E34\u65F6\u4EFB\u52A1\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => assertTools("todo_write")),
  lesson(6, "Subagent", "\u9A8C\u8BC1\u5355\u4EFB\u52A1\u59D4\u6D3E\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => assertTools("subagent")),
  lesson(7, "Skill Loading", "\u9A8C\u8BC1 Skill \u53D1\u73B0\u548C\u6309\u9700\u52A0\u8F7D\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("list_skills", "load_skill");
  }),
  lesson(8, "Context Compact", "\u9A8C\u8BC1\u957F\u5386\u53F2\u4F1A\u8BDD\u4F1A\u89E6\u53D1\u538B\u7F29\u3002", () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `message-${index} ${"x".repeat(3e3)}`
    }));
    const result = compactHistory(history);
    assert2(result.compacted, "history did not compact");
    assert2(result.after < result.before, "compaction did not reduce content");
  }),
  lesson(9, "Memory", "\u9A8C\u8BC1\u8DE8\u4F1A\u8BDD Memory \u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("memory_read", "memory_append", "memory_replace");
  }),
  lesson(10, "System Prompt", "\u9A8C\u8BC1\u7CFB\u7EDF\u63D0\u793A\u53EF\u7531 Feature \u52A8\u6001\u7EC4\u88C5\u3002", () => {
    const prompt = harness.prompts.build(process.cwd());
    assert2(prompt.prompt.includes("AI Agent"), "identity prompt missing");
    assert2(prompt.sections.length >= 5, "too few prompt sections");
  }),
  lesson(11, "Error Recovery", "\u9A8C\u8BC1 Provider \u9519\u8BEF\u5305\u542B\u53EF\u91CD\u8BD5\u5206\u7C7B\u3002", () => {
    const error = new ProviderError("temporary", 503, true, 100);
    assert2(error.retryable, "retryable provider error lost classification");
    assertEquals2(error.retryAfterMs, 100);
  }),
  lesson(12, "Task Graph", "\u9A8C\u8BC1\u6301\u4E45\u5316\u4EFB\u52A1\u56FE\u8BFB\u5199\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("task_graph_read", "task_graph_write");
  }),
  lesson(13, "Background Tasks", "\u9A8C\u8BC1\u540E\u53F0\u4EFB\u52A1\u542F\u52A8\u3001\u67E5\u8BE2\u548C\u53D6\u6D88\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("background_start", "background_status", "background_cancel");
  }),
  lesson(14, "Cron Scheduling", "\u9A8C\u8BC1\u5468\u671F\u5BF9\u8BDD\u8C03\u5EA6\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("cron_list", "cron_write", "cron_run_now");
  }),
  lesson(15, "Agent Teams", "\u9A8C\u8BC1\u5E76\u884C Team \u7F16\u6392\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => assertTools("team_run")),
  lesson(16, "Team Protocol", "\u9A8C\u8BC1 Team \u6D88\u606F\u6536\u53D1\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("team_send", "team_inbox");
  }),
  lesson(17, "Autonomous Agent", "\u9A8C\u8BC1\u81EA\u6CBB\u5FAA\u73AF\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => assertTools("autonomous_run")),
  lesson(18, "Git Worktree", "\u9A8C\u8BC1\u9694\u79BB Worktree \u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("worktree_create", "worktree_list", "worktree_agent", "worktree_remove");
  }),
  lesson(19, "MCP Plugins", "\u9A8C\u8BC1 MCP \u53D1\u73B0\u548C\u8C03\u7528\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("mcp_servers", "mcp_list_tools", "mcp_call");
  }),
  lesson(27, "A2A Handoff", "\u9A8C\u8BC1\u79DF\u6237\u9694\u79BB\u3001\u8BC1\u636E\u4EA4\u63A5\u548C\u7EC8\u6001\u7EA6\u675F\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("handoff_submit", "agent_handoff", "handoff_complete", "handoff_status");
  }),
  lesson(28, "RAG Memory", "\u9A8C\u8BC1\u79DF\u6237\u8BB0\u5FC6\u68C0\u7D22\u3001\u5F15\u7528\u548C tombstone \u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools(
      "memory_store",
      "memory_search",
      "memory_tombstone",
      "memory_status",
      "memory_migrate_legacy"
    );
  }),
  lesson(29, "Grounded Research", "\u9A8C\u8BC1\u7814\u7A76\u4EFB\u52A1\u3001\u6765\u6E90\u5F15\u7528\u3001\u7F6E\u4FE1\u5EA6\u548C\u5347\u7EA7\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("research_start", "research_add_source", "grounded_research", "research_status");
  }),
  lesson(30, "Evaluation CI", "\u9A8C\u8BC1\u7248\u672C\u5316\u6570\u636E\u96C6\u3001\u5F15\u7528\u8986\u76D6\u7387\u548C\u53D1\u5E03 Gate \u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("evaluation_gate", "evaluation_status");
  }),
  lesson(31, "Security Boundary", "\u9A8C\u8BC1\u8EAB\u4EFD\u3001\u51FA\u53E3\u3001SSRF\u3001DLP \u548C\u5BA1\u8BA1\u5DE5\u5177\u5DF2\u6CE8\u518C\u3002", () => {
    assertTools("security_boundary", "security_audit");
  }),
  lesson(20, "Comprehensive Harness", "\u9A8C\u8BC1 1\u201320 \u673A\u5236\u6C47\u805A\u5230\u540C\u4E00\u4E2A\u5DE5\u5177\u6C60\u3002", () => {
    assert2(harness.tools.names().length >= 30, "complete harness tool registry is incomplete");
  }),
  lesson(21, "Production Runtime", "\u8FD0\u884C\u5B8C\u6574 RuntimeBudget \u9A8C\u6536\u7528\u4F8B\u3002", async () => {
    const report = await runRuntimeBudgetAcceptance();
    assert2(
      report.ok,
      report.results.filter((result) => result.status === "failed").map((result) => result.detail).join("; ")
    );
  })
];
function listLessonTests() {
  return lessonTestCases.map(({ run: _run, ...test }) => test);
}
async function runLessonAcceptance(lessonNumber) {
  const selected = lessonNumber === void 0 ? lessonTestCases : lessonTestCases.filter((test) => test.lesson === lessonNumber);
  if (!selected.length) throw new Error("lesson must be an integer from 1 to 31");
  const results = [];
  for (const test of selected) {
    const startedAt = performance.now();
    try {
      await test.run();
      results.push({
        lesson: test.lesson,
        id: test.id,
        title: test.title,
        status: "passed",
        durationMs: Math.round(performance.now() - startedAt)
      });
    } catch (error) {
      results.push({
        lesson: test.lesson,
        id: test.id,
        title: test.title,
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const passed = results.filter((result) => result.status === "passed").length;
  return {
    suite: "21test-lessons",
    ok: passed === results.length,
    passed,
    failed: results.length - passed,
    results
  };
}

// ../desktop/services/ollama.ts
var OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";
function modelNames(payload) {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload;
  if (!Array.isArray(raw.models)) return [];
  return [
    ...new Set(
      raw.models.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const name = item.name;
        const normalized = typeof name === "string" ? name.trim() : "";
        return normalized && normalized.length <= 200 ? [normalized] : [];
      }).slice(0, 200)
    )
  ];
}
async function listOllamaModels() {
  try {
    const response = await fetch(OLLAMA_TAGS_URL, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return { available: false, models: [] };
    return { available: true, models: modelNames(await response.json()) };
  } catch {
    return { available: false, models: [] };
  }
}

// ../desktop/http.ts
import { createServer } from "node:http";
import { Readable } from "node:stream";
function json(data, status = 200) {
  return Response.json(data, { status });
}
function errorResponse(error, status = 400) {
  return json({ error: error instanceof Error ? error.message : String(error) }, status);
}
async function routeApi(request, url) {
  if (url.pathname === "/api/health") {
    return json({ ok: true, stage: "s21", version: APP_VERSION, capabilities: 21 });
  }
  if (url.pathname === "/api/tests/21" && request.method === "POST") {
    return json(await runRuntimeBudgetAcceptance());
  }
  if (url.pathname === "/api/tests/lessons" && request.method === "GET") {
    return json({ suite: "21test-lessons", cases: listLessonTests() });
  }
  if (url.pathname === "/api/tests/lessons" && request.method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const lesson2 = body && typeof body === "object" && "lesson" in body ? Number(body.lesson) : void 0;
      if (lesson2 !== void 0 && (!Number.isInteger(lesson2) || lesson2 < 1 || lesson2 > 31)) {
        return errorResponse("lesson must be an integer from 1 to 31", 400);
      }
      return json(await runLessonAcceptance(lesson2));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/telemetry") return json(providerTelemetry());
  if (url.pathname === "/api/ollama/models" && request.method === "GET") {
    return json(await listOllamaModels());
  }
  if (url.pathname === "/api/balance" && request.method === "GET") {
    try {
      return json(await readProviderBalance(url.searchParams.get("providerId") || void 0));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json(await getPublicSettings());
  }
  if (url.pathname === "/api/update/settings" && request.method === "GET") {
    const settings = await getPublicSettings();
    return json({
      version: APP_VERSION,
      settingsPath: settingsFilePath(),
      update: settings.update
    });
  }
  if (url.pathname === "/api/update/settings" && request.method === "POST") {
    try {
      const settings = await saveUpdateSettings(await request.json());
      return json({
        version: APP_VERSION,
        settingsPath: settings.settingsPath,
        update: settings.update
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/update/check" && request.method === "POST") {
    try {
      return json(await checkForUpdate());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/update/install" && request.method === "POST") {
    try {
      return json(await installUpdateAndRestart());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/conversations" && request.method === "GET") {
    try {
      return json({ sessions: await readConversations() });
    } catch (error) {
      return errorResponse(error, 500);
    }
  }
  if (url.pathname === "/api/conversations" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ sessions: await saveConversations(body.sessions) });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "GET") {
    try {
      return json({ schedules: await listCronSchedules() });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ schedules: await saveCronSchedules(body.schedules) });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron/run" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await runCronSchedule(String(body.id ?? "")));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/select" && request.method === "POST") {
    try {
      return json(await chooseWorkspace());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/activate" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await selectWorkspace(body.workspace));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/remove" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await removeWorkspace(body.workspace));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/tree" && request.method === "GET") {
    try {
      return json(await readWorkspaceTree());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/image" && request.method === "GET") {
    try {
      const image = await readWorkspaceImage(url.searchParams.get("path") ?? "");
      return new Response(Buffer.from(image.body), {
        headers: {
          "content-type": image.contentType,
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff"
        }
      });
    } catch (error) {
      return errorResponse(error, 404);
    }
  }
  if (url.pathname === "/api/workspace/git" && request.method === "GET") {
    try {
      return json(await readWorkspaceGit());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/file/open" && request.method === "POST") {
    try {
      const { path: path2 } = await request.json();
      await openWorkspaceFile(String(path2 ?? ""));
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "POST") {
    try {
      return json(await saveSettings(await request.json()));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/chat" && request.method === "POST") {
    try {
      const body = await request.json();
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      return json(await runChat(body));
    } catch (error) {
      return errorResponse(error, 500);
    }
  }
  if (url.pathname === "/api/chat/stream" && request.method === "POST") {
    try {
      const body = await request.json();
      return new Response(createChatStream(body), {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache"
        }
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
}
function serveAsset(url, assets) {
  const asset = assets.get(url.pathname);
  if (!asset) return void 0;
  return new Response(asset.body, {
    headers: {
      "content-type": asset.contentType,
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.deepseek.com"
    }
  });
}
async function requestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return void 0;
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
function headers(request) {
  const result = new Headers();
  for (const [key5, value2] of Object.entries(request.headers)) {
    if (value2) result.set(key5, Array.isArray(value2) ? value2.join(", ") : value2);
  }
  return result;
}
async function handleNodeRequest(request, response, assets) {
  try {
    const body = await requestBody(request);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const webRequest = new Request(url, {
      method: request.method ?? "GET",
      headers: headers(request),
      body: body ? Buffer.from(body) : void 0
    });
    const webResponse = await handleRequest(webRequest, assets);
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value2, key5) => response.setHeader(key5, value2));
    if (!webResponse.body) {
      response.end();
      return;
    }
    Readable.fromWeb(webResponse.body).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}
function startHttpServer(assets, options = {}) {
  const server = createServer((request, response) => {
    void handleNodeRequest(request, response, assets);
  });
  server.listen(options.port ?? 0, options.host ?? "127.0.0.1");
  return server;
}
async function handleRequest(request, assets) {
  const url = new URL(request.url);
  return await routeApi(request, url) ?? serveAsset(url, assets) ?? new Response("Not found", { status: 404 });
}

// main.ts
var appRoot = dirname4(fileURLToPath(import.meta.url));
var isDev = !app.isPackaged;
function configurePlatform() {
  app.setPath("userData", join4(app.getPath("appData"), "AIAgent"));
  setAppDataPath(app.getPath("userData"));
  setSecretStore({
    async get(service, account) {
      if (!safeStorage.isEncryptionAvailable()) return void 0;
      const path2 = join4(
        app.getPath("userData"),
        "secrets",
        `${createHash("sha256").update(`${service}:${account}`).digest("hex")}.bin`
      );
      try {
        const { readFile: readFile9 } = await import("node:fs/promises");
        return safeStorage.decryptString(await readFile9(path2));
      } catch {
        return void 0;
      }
    },
    async set(service, account, value2) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("\u7CFB\u7EDF\u5B89\u5168\u51ED\u636E\u5B58\u50A8\u4E0D\u53EF\u7528");
      const { mkdir: mkdir5, writeFile: writeFile3 } = await import("node:fs/promises");
      const path2 = join4(
        app.getPath("userData"),
        "secrets",
        `${createHash("sha256").update(`${service}:${account}`).digest("hex")}.bin`
      );
      await mkdir5(dirname4(path2), { recursive: true });
      await writeFile3(path2, safeStorage.encryptString(value2));
    }
  });
  setPermissionPrompt(
    (message) => dialog.showMessageBoxSync({
      type: "warning",
      buttons: ["\u62D2\u7EDD", "\u5141\u8BB8"],
      defaultId: 0,
      cancelId: 0,
      title: "AI Agent \u8BF7\u6C42\u6743\u9650",
      message
    }) === 1
  );
  setFolderChooser(async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "\u9009\u62E9 AI Agent \u5DE5\u4F5C\u76EE\u5F55"
    });
    return result.canceled ? void 0 : result.filePaths[0];
  });
}
async function createWindow() {
  const server = startHttpServer(await desktopAssets(join4(appRoot, "renderer")));
  await new Promise((resolve4) => server.once("listening", resolve4));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Electron \u672C\u5730\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "AI Agent",
    webPreferences: {
      preload: join4(appRoot, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  window.on("closed", () => server.close());
  await window.loadURL(`http://127.0.0.1:${address.port}/`);
  if (isDev) window.webContents.openDevTools({ mode: "detach" });
}
app.whenReady().then(async () => {
  configurePlatform();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
var shuttingDown = false;
app.on("before-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;
  void shutdownMcpSessions().finally(() => app.quit());
});
//# sourceMappingURL=main.mjs.map
