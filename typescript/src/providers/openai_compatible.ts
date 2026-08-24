import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";
import type { ModelProvider, ProviderConfig } from "./contracts.ts";

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
  lastCost: null as number | null,
  totalCost: 0,
  costCurrency: "CNY",
  costEstimated: false,
};
export function providerTelemetry() {
  return { ...telemetry };
}

export interface ProviderPricing {
  currency: string;
  inputCacheHitPerMillion: number;
  inputCacheMissPerMillion: number;
  outputPerMillion: number;
}

const DEEPSEEK_PRICING: Record<string, ProviderPricing> = {
  "deepseek-v4-flash": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.02,
    inputCacheMissPerMillion: 1,
    outputPerMillion: 2,
  },
  "deepseek-v4-pro": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.025,
    inputCacheMissPerMillion: 3,
    outputPerMillion: 6,
  },
  "deepseek-chat": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.02,
    inputCacheMissPerMillion: 1,
    outputPerMillion: 2,
  },
  "deepseek-reasoner": {
    currency: "CNY",
    inputCacheHitPerMillion: 0.025,
    inputCacheMissPerMillion: 3,
    outputPerMillion: 6,
  },
};

function providerPricing(config: ProviderConfig): ProviderPricing | undefined {
  const identity = `${config.id} ${config.name} ${config.baseUrl}`.toLowerCase();
  if (!identity.includes("deepseek")) return undefined;
  const model = config.model.toLowerCase();
  const match = Object.keys(DEEPSEEK_PRICING).find((key) => model.includes(key));
  return match ? DEEPSEEK_PRICING[match] : undefined;
}

/** Estimate a provider charge from the usage returned by an OpenAI-compatible API. */
export function estimateProviderCost(
  config: ProviderConfig,
  usage: NonNullable<ChatResponse["usage"]>,
): { amount: number; currency: string; estimated: boolean } | undefined {
  if (Number.isFinite(usage.cost)) {
    return {
      amount: Math.max(0, Number(usage.cost)),
      currency: usage.currency?.trim() || "USD",
      estimated: false,
    };
  }
  const pricing = providerPricing(config);
  if (!pricing) return undefined;
  const promptTokens = Math.max(0, usage.prompt_tokens ?? 0);
  const cacheHitTokens = Math.max(0, usage.prompt_cache_hit_tokens ?? 0);
  const cacheMissTokens = Math.max(
    0,
    usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens),
  );
  const completionTokens = Math.max(0, usage.completion_tokens ?? 0);
  if (!promptTokens && !cacheHitTokens && !cacheMissTokens && !completionTokens) return undefined;
  return {
    amount: (
      cacheHitTokens * pricing.inputCacheHitPerMillion +
      cacheMissTokens * pricing.inputCacheMissPerMillion +
      completionTokens * pricing.outputPerMillion
    ) / 1_000_000,
    currency: pricing.currency,
    estimated: true,
  };
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

export async function createOpenAICompatibleCompletion(
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

export const openAICompatibleProvider: ModelProvider = {
  id: "openai-compatible",
  createChatCompletion: createOpenAICompatibleCompletion,
};
