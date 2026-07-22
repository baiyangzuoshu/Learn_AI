import { ProviderError } from "../providers/openai_compatible.ts";
import { getModelProvider } from "../providers/registry.ts";
import { getWorkspace, resolveProviderConfig } from "../config/settings.ts";
import type { Message } from "../core/types.ts";
import type { HarnessFeature, RunOptions } from "./contracts.ts";
import { ToolRegistry } from "./registry.ts";
import { PromptRegistry } from "./prompt.ts";
import { authorize } from "./permissions.ts";
import { compactHistory } from "./context.ts";

export class AgentRuntime {
  //
  readonly tools = new ToolRegistry();
  //
  readonly prompts = new PromptRegistry();
  //
  constructor(features: HarnessFeature[]) {
    for (const feature of features) {
      feature.register({ tools: this.tools, prompts: this.prompts, run: this.run.bind(this) });
    }
  }
  //
  async run(options: RunOptions): Promise<string> {
    //
    const workspace = options.workspace ?? await getWorkspace();
    //
    const config = await resolveProviderConfig(options.providerId, options.model);
    //
    const compacted = compactHistory(options.history ?? []);
    //
    if (compacted.compacted) {
      options.onEvent?.({
        type: "hook",
        name: "ContextCompact",
        detail: `${compacted.before} → ${compacted.after} chars`,
      });
    }
    const prompt = this.prompts.build(workspace);
    options.onEvent?.({
      type: "hook",
      name: "SystemPromptAssembled",
      detail: `${prompt.sections.length} sections · ${prompt.prompt.length} chars`,
    });
    //
    const messages: Message[] = [
      { role: "system", content: prompt.prompt },
      ...compacted.history.filter((item) => item.role === "user" || item.role === "assistant"),
      { role: "user", content: options.query },
    ];
    //
    let toolCount = 0;
    //
    while (true) {
      if (options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
      //
      const response = await this.#complete(config, messages, options);
      //
      const assistant = response.choices[0]?.message;

      if (!assistant) throw new Error("Model returned no message");
      messages.push(assistant);
      //
      if (!assistant.tool_calls?.length) {
        options.onEvent?.({ type: "hook", name: "Stop", detail: `${toolCount} tool calls` });
        return assistant.content ?? "";
      }
      //
      for (const call of assistant.tool_calls) {
        let output: string;
        try {
          const tool = this.tools.get(call.function.name);
          //
          if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);
          //
          const input = JSON.parse(call.function.arguments) as Record<string, unknown>;
          //
          options.onEvent?.({ type: "hook", name: "PreToolUse", detail: call.function.name });
          //
          await authorize({ name: call.function.name, input }, options.permissionMode ?? "ask");
          //
          output = await tool.handler(input, { workspace, signal: options.signal });

          toolCount++;
          //
          options.onEvent?.({
            type: "hook",
            name: "PostToolUse",
            detail: `${call.function.name} · ${output.length} chars`,
          });
        } catch (error) {
          output = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
        options.onEvent?.({
          type: "tool",
          name: call.function.name,
          input: call.function.arguments,
          output,
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: output });
      }
    }
  }
  //
  async #complete(
    config: Awaited<ReturnType<typeof resolveProviderConfig>>,
    messages: Message[],
    options: RunOptions,
  ) {
    //
    const delays = [600, 1200, 2400];
    //
    for (let attempt = 0;; attempt++) {
      try {
        //
        return await getModelProvider(config).createChatCompletion(
          config,
          messages,
          this.tools.definitions(),
          options.signal,
        );
      } catch (error) {
        //
        if (options.signal?.aborted) throw error;
        //
        const retryable = error instanceof ProviderError
          ? error.retryable
          : error instanceof TypeError;
        if (!retryable || attempt >= delays.length) throw error;

        const delay = error instanceof ProviderError && error.retryAfterMs
          ? Math.min(error.retryAfterMs, 10_000)
          : delays[attempt];
          //
        options.onEvent?.({
          type: "hook",
          name: "ErrorRecovery",
          detail: `retry ${attempt + 1}/3 · ${delay}ms`,
        });
        //
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          //
          options.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Generation stopped", "AbortError"));
          }, { once: true });
        });
      }
    }
  }
}
