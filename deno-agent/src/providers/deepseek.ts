import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
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
    apiKey,
    baseUrl: (Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-chat",
  };
}

export async function createChatCompletion(
  config: DeepSeekConfig,
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
      `DeepSeek API ${response.status}: ${detail}`,
      response.status,
      response.status === 408 || response.status === 429 || response.status >= 500,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : undefined,
    );
  }
  return await response.json() as ChatResponse;
}
