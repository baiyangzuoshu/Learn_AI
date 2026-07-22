import type { ModelProvider, ProviderConfig } from "./contracts.ts";
import { createOpenAICompatibleCompletion } from "./openai_compatible.ts";

export { ProviderError } from "./openai_compatible.ts";
export const createChatCompletion = createOpenAICompatibleCompletion;

export type DeepSeekConfig = ProviderConfig;

export function deepSeekConfigFromEnv(): DeepSeekConfig {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  return {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai",
    apiKey,
    baseUrl: (Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat",
  };
}

export const deepSeekProvider: ModelProvider = {
  id: "deepseek",
  createChatCompletion: createOpenAICompatibleCompletion,
};
