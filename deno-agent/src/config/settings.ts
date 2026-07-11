import type { DeepSeekConfig } from "../providers/deepseek.ts";

const SERVICE = "com.youjunmao.deno-agent";
const ACCOUNT = "deepseek-api-key";
const DEFAULT_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];

export interface PublicSettings { baseUrl: string; models: string[]; defaultModel: string; hasApiKey: boolean }
interface StoredSettings { baseUrl: string; models: string[]; defaultModel: string }

function settingsPath(): string {
  const home = Deno.env.get("HOME");
  if (!home) throw new Error("HOME is unavailable");
  return `${home}/Library/Application Support/DenoAgent/settings.json`;
}

async function readStored(): Promise<StoredSettings> {
  const fallback = { baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com", models: DEFAULT_MODELS, defaultModel: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash" };
  try {
    const parsed = JSON.parse(await Deno.readTextFile(settingsPath())) as Partial<StoredSettings>;
    const savedModels = parsed.models?.filter(Boolean);
    const legacyDefaults = ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"];
    const models = savedModels?.join("\n") === legacyDefaults.join("\n") ? DEFAULT_MODELS : savedModels ?? fallback.models;
    return { baseUrl: parsed.baseUrl?.trim() || fallback.baseUrl, models, defaultModel: parsed.defaultModel && models.includes(parsed.defaultModel) ? parsed.defaultModel : models[0] };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return fallback;
    throw error;
  }
}

async function keychain(args: string[]): Promise<{ ok: boolean; output: string }> {
  const result = await new Deno.Command("/usr/bin/security", { args, stdout: "piped", stderr: "null" }).output();
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
  return { ...stored, hasApiKey: Boolean(await readKey()) };
}

export async function saveSettings(input: { apiKey?: string; baseUrl: string; models: string[]; defaultModel: string }): Promise<PublicSettings> {
  const models = [...new Set(input.models.map((item) => item.trim()).filter(Boolean))];
  if (!input.baseUrl.startsWith("https://")) throw new Error("Base URL 必须使用 HTTPS");
  if (!models.length) throw new Error("至少配置一个模型");
  if (!models.includes(input.defaultModel)) throw new Error("默认模型不在模型列表中");
  if (input.apiKey?.trim()) {
    const result = await keychain(["add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", input.apiKey.trim()]);
    if (!result.ok) throw new Error("无法写入 macOS Keychain");
  }
  const path = settingsPath();
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify({ baseUrl: input.baseUrl.replace(/\/$/, ""), models, defaultModel: input.defaultModel }, null, 2));
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
