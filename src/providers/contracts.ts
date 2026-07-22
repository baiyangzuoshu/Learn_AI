import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ModelProvider {
  id: string;
  createChatCompletion(
    config: ProviderConfig,
    messages: Message[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): Promise<ChatResponse>;
}
