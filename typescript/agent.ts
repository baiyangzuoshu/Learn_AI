import { createChatCompletion } from "./provider.ts";
import { ToolRegistry } from "./tools.ts";
import type { Message, ProviderConfig, ToolCall } from "./types.ts";

export interface AgentOptions {
  maxIterations?: number;
  signal?: AbortSignal;
  onToolEvent?: (call: ToolCall, result: string) => void;
}

export class AgentRuntime {
  constructor(
    readonly provider: ProviderConfig,
    readonly tools: ToolRegistry,
    readonly options: AgentOptions = {},
  ) {}

  async runTurn(messages: Message[], query: string): Promise<string> {
    messages.push({ role: "user", content: query });
    const maxIterations = this.options.maxIterations ?? 8;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (this.options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
      const response = await createChatCompletion(
        this.provider,
        messages,
        this.tools.definitions(),
        this.options.signal,
      );
      const assistant = response.message;
      messages.push(assistant);
      const calls = assistant.tool_calls ?? [];
      if (calls.length === 0) return assistant.content ?? "";

      for (const call of calls) {
        const tool = this.tools.get(call.function.name);
        const result = tool
          ? await tool.execute(call.function.arguments).catch((error: unknown) =>
            `Error: ${error instanceof Error ? error.message : String(error)}`
          )
          : `Error: unknown tool '${call.function.name}'`;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
        this.options.onToolEvent?.(call, result);
      }
    }
    return "已达到本轮最大工具循环次数，已停止继续执行工具。";
  }
}
