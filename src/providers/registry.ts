import type { ModelProvider, ProviderConfig } from "./contracts.ts";
import { deepSeekProvider } from "./deepseek.ts";
import { mimoProvider } from "./mimo.ts";
import { openAICompatibleProvider } from "./openai_compatible.ts";

const providers = new Map<string, ModelProvider>([
  [deepSeekProvider.id, deepSeekProvider],
  [mimoProvider.id, mimoProvider],
]);

export function getModelProvider(config: ProviderConfig): ModelProvider {
  const id = config.id.toLowerCase();
  const name = config.name.toLowerCase();
  if (id.includes("mimo") || name.includes("mimo")) return mimoProvider;
  return providers.get(id) ?? openAICompatibleProvider;
}
