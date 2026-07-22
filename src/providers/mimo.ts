import type { ModelProvider } from "./contracts.ts";
import { createOpenAICompatibleCompletion } from "./openai_compatible.ts";

export const mimoProvider: ModelProvider = {
  id: "mimo",
  createChatCompletion: createOpenAICompatibleCompletion,
};
