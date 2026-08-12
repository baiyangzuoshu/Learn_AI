import { ProviderError } from "./providers/openai_compatible.ts";
import { getModelProvider } from "./providers/registry.ts";
import { getWorkspace, resolveProviderConfig } from "./config/settings.ts";
import type { Message } from "./core/types.ts";
import {
  BudgetExceededError,
  type HarnessFeature,
  resolveRunBudget,
  type RunOptions,
  RuntimeBudget,
} from "./contracts.ts";
import { ToolRegistry } from "./registry.ts";
import { PromptRegistry } from "./prompt.ts";
import { authorize } from "./permissions.ts";
import { compactHistory } from "./context.ts";

export interface AgentRuntimeDependencies {
  resolveProviderConfig?: typeof resolveProviderConfig;
  getModelProvider?: typeof getModelProvider;
}

export class AgentRuntime {
  //
  readonly tools = new ToolRegistry();
  //
  readonly prompts = new PromptRegistry();
  #resolveProviderConfig: typeof resolveProviderConfig;
  #getModelProvider: typeof getModelProvider;
  //
  constructor(features: HarnessFeature[], dependencies: AgentRuntimeDependencies = {}) {
    this.#resolveProviderConfig = dependencies.resolveProviderConfig ?? resolveProviderConfig;
    this.#getModelProvider = dependencies.getModelProvider ?? getModelProvider;
    for (const feature of features) {
      feature.register({ tools: this.tools, prompts: this.prompts, run: this.run.bind(this) });
    }
  }
  //
  async run(options: RunOptions): Promise<string> {
    //
    const workspace = options.workspace ?? await getWorkspace();
    //
    const config = await this.#resolveProviderConfig(options.providerId, options.model);
    //
    const compacted = compactHistory(options.history ?? []);
    const budget = options.budget instanceof RuntimeBudget
      ? options.budget
      : new RuntimeBudget(resolveRunBudget(options.budget));
    options.onEvent?.({
      type: "hook",
      name: "RunBudget",
      detail: JSON.stringify(budget.snapshot()),
    });
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
    let usageEmitted = false;
    const emitUsage = () => {
      if (usageEmitted) return;
      usageEmitted = true;
      options.onEvent?.({
        type: "hook",
        name: "RunUsage",
        detail: JSON.stringify(budget.snapshot()),
      });
    };
    try {
      //
      while (true) {
        if (options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
        budget.consume("iterations");
        //
        const response = await this.#complete(config, messages, options, budget);
        //
        const assistant = response.choices[0]?.message;

        if (!assistant) throw new Error("Model returned no message");
        const assistantContent = assistant.content ?? "";
        budget.consume("outputChars", assistantContent.length);
        messages.push(assistant);
        //
        if (!assistant.tool_calls?.length) {
          emitUsage();
          options.onEvent?.({
            type: "hook",
            name: "Stop",
            detail: `${toolCount} tool calls · ${JSON.stringify(budget.snapshot().used)}`,
          });
          return assistantContent;
        }
        //
        for (const call of assistant.tool_calls) {
          budget.consume("toolCalls");
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
            output = await tool.handler(input, { workspace, signal: options.signal, budget });

            toolCount++;
            //
            options.onEvent?.({
              type: "hook",
              name: "PostToolUse",
              detail: `${call.function.name} · ${output.length} chars`,
            });
          } catch (error) {
            if (error instanceof BudgetExceededError) throw error;
            output = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }
          budget.consume("outputChars", output.length);
          options.onEvent?.({
            type: "tool",
            name: call.function.name,
            input: call.function.arguments,
            output,
          });
          messages.push({ role: "tool", tool_call_id: call.id, content: output });
        }
      }
    } catch (error) {
      emitUsage();
      if (error instanceof BudgetExceededError) {
        options.onEvent?.({ type: "hook", name: "BudgetExceeded", detail: error.message });
      }
      throw error;
    }
  }
  //
  async #complete(
    config: Awaited<ReturnType<typeof resolveProviderConfig>>,
    messages: Message[],
    options: RunOptions,
    budget: RuntimeBudget,
  ) {
    //
    const delays = [600, 1200, 2400];
    //
    for (let attempt = 0;; attempt++) {
      try {
        //
        budget.consume("cost");
        return await this.#getModelProvider(config).createChatCompletion(
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
