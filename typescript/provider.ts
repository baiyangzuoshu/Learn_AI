import type { ChatResponse, Message, ProviderConfig, ToolCall, ToolDefinition } from "./types.ts";

export class ProviderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ToolCall[] => {
    if (!isRecord(item)) return [];
    const fn = isRecord(item.function) ? item.function : undefined;
    if (
      typeof item.id !== "string" ||
      item.type !== "function" ||
      !fn ||
      typeof fn.name !== "string" ||
      typeof fn.arguments !== "string"
    ) return [];
    return [{
      id: item.id,
      type: "function",
      function: { name: fn.name, arguments: fn.arguments },
    }];
  });
}

function parseResponse(value: unknown): ChatResponse {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    throw new Error("DeepSeek returned no choices");
  }
  const choice = value.choices[0];
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : undefined;
  if (!message || (message.role !== "assistant" && message.role !== undefined)) {
    throw new Error("DeepSeek returned an invalid assistant message");
  }
  const content = message.content === null || typeof message.content === "string"
    ? message.content
    : null;
  return {
    message: {
      role: "assistant",
      content,
      tool_calls: parseToolCalls(message.tool_calls),
    },
  };
}

export async function createChatCompletion(
  config: ProviderConfig,
  messages: Message[],
  tools: ToolDefinition[],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: config.model, messages, tools, stream: false }),
    signal,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2_000);
    throw new ProviderError(response.status, `DeepSeek API ${response.status}: ${detail}`);
  }
  return parseResponse(await response.json() as unknown);
}
