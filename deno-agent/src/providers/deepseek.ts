import type { ChatResponse, Message, ToolDefinition } from "../core/types.ts";

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
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
): Promise<ChatResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: config.model, messages, tools, temperature: 0 }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2_000);
    throw new Error(`DeepSeek API ${response.status}: ${detail}`);
  }
  return await response.json() as ChatResponse;
}
