import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
  contextWindowTokens?: number;
  outputTokenReserve?: number;
  safetyMarginTokens?: number;
  compactionTargetRatio?: number;
  tokenEstimator?: "multilingual-v1" | "conservative-v1";
  contextSummaryInputTokens?: number;
  contextSummaryOutputTokens?: number;
  contextSummaryCallBudget?: number;
}

export interface ImageGenerationConfig {
  provider: "volcengine-ark";
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
    options?: ProviderRequestOptions,
  ): Promise<ChatResponse>;
}

/** Per-call controls supported by provider adapters. */
export interface ProviderRequestOptions {
  maxOutputTokens?: number;
}
