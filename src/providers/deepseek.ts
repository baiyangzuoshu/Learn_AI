import type { ModelProvider, ProviderConfig } from "./contracts.ts";
import { createOpenAICompatibleCompletion } from "./openai_compatible.ts";
import { environment } from "../platform.ts";

export { ProviderError } from "./openai_compatible.ts";
export const createChatCompletion = createOpenAICompatibleCompletion;

export type DeepSeekConfig = ProviderConfig;

export function deepSeekConfigFromEnv(): DeepSeekConfig {
  const apiKey = environment("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  return {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai",
    apiKey,
    baseUrl: (environment("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: environment("DEEPSEEK_MODEL") ?? "deepseek-chat",
  };
}

export const deepSeekProvider: ModelProvider = {
  id: "deepseek",
  createChatCompletion: createOpenAICompatibleCompletion,
};
