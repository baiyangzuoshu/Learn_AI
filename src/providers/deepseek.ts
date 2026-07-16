import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type DeepSeekConfig = ProviderConfig;

const telemetry = {
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
};
export function providerTelemetry() {
  return { ...telemetry };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

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

export async function createChatCompletion(
  config: ProviderConfig,
  messages: Message[],
  tools: ToolDefinition[],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: config.model, messages, tools, temperature: 0 }),
    signal,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2_000);
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ProviderError(
      `${config.name} API ${response.status}: ${detail}`,
      response.status,
      response.status === 408 || response.status === 429 || response.status >= 500,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : undefined,
    );
  }
  const payload = await response.json() as ChatResponse;
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
  }
  return payload;
}
