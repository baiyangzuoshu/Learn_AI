import { isContextWindowExceeded, ProviderError } from "./providers/openai_compatible.ts";
import { getModelProvider } from "./providers/registry.ts";
import { getWorkspace, resolveProviderConfig } from "./config/settings.ts";
import type { ChatResponse, Message, ToolDefinition } from "./core/types.ts";
import {
  BudgetExceededError,
  type CapabilityDefinition,
  type HarnessEvent,
  type HarnessFeature,
  resolveRunBudget,
  type RunOptions,
  RuntimeBudget,
} from "./contracts.ts";
import { ToolRegistry } from "./registry.ts";
import { PromptRegistry } from "./prompt.ts";
import { authorize } from "./permissions.ts";
import {
  assertToolCallPairs,
  buildStructuredSummaryMessages,
  compactRequestContext,
  ContextSummaryBudgetExceededError,
  estimateRequestComponents,
  estimateRequestInputTokens,
  fitRequestToContextBudget,
  formatStructuredContextSummary,
  parseStructuredContextSummary,
} from "./context.ts";
import { estimateTokensFromText } from "./contracts.ts";
import { loadSummaryCheckpoint, saveSummaryCheckpoint } from "./context_checkpoint.ts";
import { TraceBook, type TraceSpan, type TraceStatus } from "./trace.ts";
import { archiveToolResult, formatToolResultArchive } from "./tool_result_store.ts";
import {
  authorizeToolPolicy,
  boundedToolOutput,
  createPrincipal,
  ToolPolicyError,
} from "./tool_policy.ts";

type TraceEvent = Omit<HarnessEvent, "type">;

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
  #capabilities = new Map<string, CapabilityDefinition>();
  //
  constructor(features: HarnessFeature[], dependencies: AgentRuntimeDependencies = {}) {
    this.#resolveProviderConfig = dependencies.resolveProviderConfig ?? resolveProviderConfig;
    this.#getModelProvider = dependencies.getModelProvider ?? getModelProvider;
    for (const feature of features) {
      const capability = feature.capability ?? {
        id: "core",
        title: "Core",
        description: "Essential workspace and safety tools.",
        alwaysAvailable: true,
      };
      if (capability.id !== "core" && capability.id !== "security") {
        const previous = this.#capabilities.get(capability.id);
        if (
          previous &&
          (previous.title !== capability.title || previous.description !== capability.description)
        ) throw new Error(`Conflicting capability metadata: ${capability.id}`);
        this.#capabilities.set(capability.id, capability);
      }
      feature.register({
        tools: {
          register: (definition, handler, policy, metadata) =>
            this.tools.register(definition, handler, policy, {
              ...metadata,
              group: metadata?.group ?? capability.id,
            }),
        },
        prompts: {
          register: (section) =>
            this.prompts.register({ ...section, group: section.group ?? capability.id }),
        },
        run: this.run.bind(this),
      });
    }
    const capabilities = [...this.#capabilities.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (capabilities.length) {
      this.tools.register(
        {
          type: "function",
          function: {
            name: "load_capability",
            description: "Load an optional tool group and its instructions for this run",
            parameters: {
              type: "object",
              properties: {
                capability: {
                  type: "string",
                  enum: capabilities.map((item) => item.id),
                },
              },
              required: ["capability"],
            },
          },
        },
        async (input, context) => {
          const id = String(input.capability ?? "");
          const capability = context.activateCapability?.(id);
          if (!capability) throw new Error(`Unknown optional capability: ${id}`);
          const names = this.tools.namesInGroup(id);
          return `Loaded ${capability.title}. Its tools and instructions are available on the next model request: ${
            names.join(", ") || "none"
          }.`;
        },
        { risk: "read-only", scopes: ["read"], maxOutput: 1_000 },
        { group: "core" },
      );
    }
  }
  //
  async run(options: RunOptions): Promise<string> {
    const traces = new TraceBook();
    const rootSpan = traces.start("agent.run", "run");
    let status: TraceStatus = "ok";
    const budget = options.budget instanceof RuntimeBudget
      ? options.budget
      : new RuntimeBudget(resolveRunBudget(options.budget));
    try {
      return await this.#run({ ...options, budget }, traces, rootSpan);
    } catch (error) {
      status =
        options.signal?.aborted || error instanceof DOMException && error.name === "AbortError"
          ? "cancelled"
          : "error";
      throw error;
    } finally {
      const summary = traces.summary(rootSpan, status, budget.tokenUsage.snapshot());
      options.onEvent?.({
        type: "hook",
        name: "TraceSummary",
        detail: JSON.stringify(summary),
        traceId: summary.traceId,
        spanId: summary.rootSpanId,
        durationMs: summary.durationMs,
        traceStatus: summary.status,
      });
    }
  }

  async #run(options: RunOptions, traces: TraceBook, rootSpan: TraceSpan): Promise<string> {
    const emitHook = (event: TraceEvent, span: TraceSpan = rootSpan) => {
      options.onEvent?.({
        type: "hook",
        ...event,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
      });
    };
    const emitTool = (event: TraceEvent, span: TraceSpan) => {
      options.onEvent?.({
        type: "tool",
        ...event,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        durationMs: span.durationMs,
        traceStatus: span.status,
      });
    };
    //
    const workspace = options.workspace ?? await getWorkspace();
    const sessionId = options.sessionId?.trim() || rootSpan.traceId;
    const principal = {
      ...createPrincipal(options.permissionMode ?? "ask", options.principal),
      subject: options.principal?.subject ?? "local-agent",
      tenant: options.principal?.tenant ?? "local",
    };
    //
    const config = await this.#resolveProviderConfig(options.providerId, options.model);
    //
    const budget = options.budget as RuntimeBudget;
    emitHook({
      name: "RunBudget",
      detail: JSON.stringify(budget.snapshot()),
    });
    //
    const activeGroups = new Set<string>(["core", "security"]);
    for (const capability of this.#capabilities.values()) {
      if (capability.alwaysAvailable) activeGroups.add(capability.id);
    }
    const prompt = this.#buildPrompt(workspace, activeGroups);
    emitHook({
      name: "SystemPromptAssembled",
      detail: `${prompt.sections.length} sections · ${prompt.prompt.length} chars`,
    });
    //
    const persistedHistory = (options.history ?? []).filter((item) =>
      item.role === "user" || item.role === "assistant" && !item.tool_calls?.length
    );
    const checkpoint = await loadSummaryCheckpoint(sessionId, workspace, persistedHistory);
    const resumedHistory = checkpoint
      ? persistedHistory.slice(checkpoint.historyCount)
      : persistedHistory;
    const historyIndexes = new Map(persistedHistory.map((message, index) => [message, index]));
    const messages: Message[] = [
      { role: "system", content: prompt.prompt },
      ...(checkpoint ? [{ role: "system" as const, content: checkpoint.summary }] : []),
      ...resumedHistory,
      { role: "user", content: options.query },
    ];
    //
    let toolCount = 0;
    const consumedToolCallIds = new Set<string>();
    let usageEmitted = false;
    const emitUsage = () => {
      if (usageEmitted) return;
      usageEmitted = true;
      emitHook({
        name: "RunUsage",
        detail: JSON.stringify(budget.snapshot()),
      });
    };
    try {
      //
      while (true) {
        if (options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
        budget.consume("iterations");
        messages[0].content = this.#buildPrompt(workspace, activeGroups).prompt;
        //
        const response = await this.#complete(
          config,
          messages,
          options,
          budget,
          traces,
          rootSpan,
          consumedToolCallIds,
          sessionId,
          workspace,
          activeGroups,
          persistedHistory,
          historyIndexes,
        );
        // A successful provider response means it consumed every tool result currently in history.
        for (const message of messages) {
          if (message.role === "tool" && message.tool_call_id) {
            consumedToolCallIds.add(message.tool_call_id);
          }
        }
        //
        const assistant = response.choices[0]?.message;

        if (!assistant) throw new Error("Model returned no message");
        const assistantContent = assistant.content ?? "";
        budget.consume("outputChars", assistantContent.length);
        messages.push(assistant);
        //
        if (!assistant.tool_calls?.length) {
          emitUsage();
          emitHook({
            name: "Stop",
            detail: `${toolCount} tool calls · ${JSON.stringify(budget.snapshot().used)}`,
          });
          return assistantContent;
        }
        //
        for (const call of assistant.tool_calls) {
          budget.consume("toolCalls");
          const toolSpan = traces.start(`tool.${call.function.name}`, "tool", rootSpan);
          const tool = this.tools.get(call.function.name);
          let output: string;
          try {
            if (!tool) throw new Error(`Unknown tool: ${call.function.name}`);
            //
            const input = JSON.parse(call.function.arguments) as Record<string, unknown>;
            //
            authorizeToolPolicy(tool.policy, principal);
            emitHook({
              name: "ToolPolicyAuthorized",
              detail: `${tool.policy.name} · ${tool.policy.risk} · scopes=${
                tool.policy.scopes.join(",")
              }`,
            }, toolSpan);
            emitHook({ name: "PreToolUse", detail: call.function.name }, toolSpan);
            //
            await authorize(
              { name: call.function.name, input },
              options.permissionMode ?? "ask",
              tool.policy,
            );
            //
            output = await tool.handler(input, {
              workspace,
              sessionId,
              signal: options.signal,
              budget,
              tokenUsage: budget.tokenUsage,
              principal,
              activateCapability: (id) => {
                const capability = this.#capabilities.get(id);
                if (!capability) throw new Error(`Unknown optional capability: ${id}`);
                activeGroups.add(id);
                return capability;
              },
            });

            if (output.length > tool.policy.maxOutput) {
              const archived = await archiveToolResult(workspace, sessionId, output);
              output = formatToolResultArchive(archived, tool.policy.maxOutput);
              emitHook({
                name: "ToolResultArchive",
                detail: JSON.stringify({
                  stored: archived.stored,
                  reference: archived.reference,
                  sizeChars: archived.sizeChars,
                  sizeBytes: archived.sizeBytes,
                  error: archived.error,
                }),
              }, toolSpan);
            }
            const bounded = boundedToolOutput(output, tool.policy);
            if (bounded.length !== output.length) {
              emitHook({
                name: "ToolOutputTruncated",
                detail: `${tool.policy.name} · ${output.length} → ${bounded.length} chars`,
              }, toolSpan);
            }
            output = bounded;

            if (call.function.name.startsWith("task_") && output.startsWith('{"task":')) {
              emitHook({ name: "TaskState", detail: output }, toolSpan);
            }
            if (call.function.name.startsWith("worker_") && output.startsWith('{"worker":')) {
              emitHook({ name: "WorkerState", detail: output }, toolSpan);
            }
            if (
              (call.function.name.startsWith("handoff_") ||
                call.function.name === "agent_handoff") &&
              output.startsWith('{"handoff":')
            ) {
              emitHook({ name: "HandoffState", detail: output }, toolSpan);
            }
            if (
              (call.function.name.startsWith("research_") ||
                call.function.name === "grounded_research") &&
              output.startsWith('{"research":')
            ) {
              emitHook({ name: "ResearchState", detail: output }, toolSpan);
            }
            if (
              call.function.name.startsWith("evaluation_") &&
              output.startsWith('{"evaluation":')
            ) {
              emitHook({ name: "EvaluationState", detail: output }, toolSpan);
            }

            toolCount++;
            //
            traces.end(toolSpan, "ok");
            emitHook({
              name: "PostToolUse",
              detail: `${call.function.name} · ${output.length} chars`,
            }, toolSpan);
          } catch (error) {
            traces.end(toolSpan, options.signal?.aborted ? "cancelled" : "error");
            if (error instanceof ToolPolicyError) {
              emitHook({
                name: "ToolPolicyDenied",
                detail: `${call.function.name} · ${error.reason} · ${error.message}`,
              }, toolSpan);
            }
            if (error instanceof BudgetExceededError) throw error;
            output = `Error: ${error instanceof Error ? error.message : String(error)}`;
          }
          output = tool ? boundedToolOutput(output, tool.policy) : output;
          budget.consume("outputChars", output.length);
          emitTool({
            name: call.function.name,
            input: call.function.arguments,
            output,
          }, toolSpan);
          messages.push({ role: "tool", tool_call_id: call.id, content: output });
        }
      }
    } catch (error) {
      emitUsage();
      if (error instanceof BudgetExceededError) {
        emitHook({ name: "BudgetExceeded", detail: error.message });
      }
      throw error;
    }
  }
  //
  #buildPrompt(workspace: string, activeGroups: ReadonlySet<string>) {
    const built = this.prompts.build(workspace, activeGroups);
    const directory = [...this.#capabilities.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((capability) => `- ${capability.id}: ${capability.description}`)
      .join("\n");
    const catalog = directory
      ? `\n\n## Optional capability directory\nLoad a group with load_capability when its tools are needed.\n${directory}`
      : "";
    return { ...built, prompt: `${built.prompt}${catalog}` };
  }

  async #complete(
    config: Awaited<ReturnType<typeof resolveProviderConfig>>,
    messages: Message[],
    options: RunOptions,
    budget: RuntimeBudget,
    traces: TraceBook,
    parent: TraceSpan,
    consumedToolCallIds: ReadonlySet<string>,
    sessionId: string,
    workspace: string,
    activeGroups: ReadonlySet<string>,
    persistedHistory: Message[],
    historyIndexes: ReadonlyMap<Message, number>,
  ) {
    //
    const delays = [600, 1200, 2400];
    //
    for (let attempt = 0;; attempt++) {
      const providerSpan = traces.start("provider.chat", "provider", parent);
      let requestRecorded = false;
      try {
        //
        const tools = this.tools.visibleDefinitions(activeGroups);
        const beforeCompactionTokens = estimateRequestInputTokens(
          messages,
          tools,
          config.tokenEstimator,
        );
        const previousEstimate = budget.tokenUsage.contextBudget?.lastEstimatedInputTokens;
        assertToolCallPairs(messages);
        const compaction = await compactRequestContext(messages, tools, config, {
          workspace,
          sessionId,
          consumedToolCallIds,
        });
        let layeredCompaction = compaction.compacted;
        if (compaction.summaryNeeded) {
          const currentRequest = [...messages].reverse().find((message) => message.role === "user");
          if (!currentRequest) {
            throw new Error("Cannot summarize context without the current request");
          }
          const summary = await this.#summarizeContext(
            compaction.summarySource,
            String(currentRequest.content ?? ""),
            compaction.summaryReferences,
            config,
            options,
            budget,
            traces,
            parent,
          );
          summary.evidence = [
            ...summary.evidence,
            ...compaction.summaryReferences.map((reference) =>
              `Archived context reference: ${reference}`
            ),
          ].filter((item, index, items) => items.indexOf(item) === index);
          const summaryText = formatStructuredContextSummary(summary);
          this.#installStructuredSummary(messages, summaryText);
          await this.#persistSummaryCheckpoint(
            sessionId,
            workspace,
            persistedHistory,
            historyIndexes,
            compaction.summarySource,
            formatStructuredContextSummary({
              ...summary,
              currentGoal: "The current request is supplied separately.",
            }),
          );
          layeredCompaction = true;
        }
        const previousCompactions = budget.tokenUsage.contextBudget?.compactions ?? 0;
        const fitted = fitRequestToContextBudget(
          messages,
          tools,
          config,
          budget.tokenUsage.contextBudget ??= {
            contextWindowTokens: config.contextWindowTokens ?? 32_768,
            outputTokenReserve: config.outputTokenReserve ?? 4_096,
            safetyMarginTokens: config.safetyMarginTokens ?? 2_048,
            inputBudgetTokens: (config.contextWindowTokens ?? 32_768) -
              (config.outputTokenReserve ?? 4_096) - (config.safetyMarginTokens ?? 2_048),
            compactionTargetTokens: 0,
            lastEstimatedInputTokens: 0,
            compactions: 0,
          },
        );
        if (layeredCompaction && !fitted.compacted) {
          budget.tokenUsage.contextBudget!.compactions = previousCompactions + 1;
        }
        if (layeredCompaction || fitted.compacted) {
          budget.tokenUsage.recordContextReduction(
            Math.max(0, beforeCompactionTokens - fitted.estimatedInputTokens),
          );
          options.onEvent?.({
            type: "hook",
            name: "ContextCompact",
            detail: `${
              previousEstimate ?? "initial"
            } → ${fitted.estimatedInputTokens} estimated tokens · target ${fitted.targetTokens}`,
          });
        }
        budget.tokenUsage.recordEstimate(
          estimateRequestComponents(messages, tools),
          config.tokenEstimator,
        );
        budget.consume("cost");
        requestRecorded = true;
        const response = await this.#getModelProvider(config).createChatCompletion(
          config,
          messages,
          tools,
          options.signal,
          { maxOutputTokens: config.outputTokenReserve ?? 4_096 },
        );
        this.#recordTruncation(response, budget, "answer", options);
        budget.tokenUsage.recordResponse(response.usage);
        traces.end(providerSpan, "ok");
        return response;
      } catch (error) {
        if (requestRecorded) budget.tokenUsage.recordFailure();
        traces.end(providerSpan, options.signal?.aborted ? "cancelled" : "error");
        //
        if (options.signal?.aborted) throw error;
        if (error instanceof BudgetExceededError) throw error;
        if (isContextWindowExceeded(error)) {
          const usage = budget.tokenUsage;
          if (usage.contextOverflowRecoveries >= 1) throw error;
          usage.contextOverflowRecoveries++;
          const tools = this.tools.visibleDefinitions(activeGroups);
          const compaction = await compactRequestContext(messages, tools, config, {
            workspace,
            sessionId,
            consumedToolCallIds,
            force: true,
          });
          if (!compaction.compacted) throw error;
          if (compaction.summarySource.length) {
            const currentRequest = [...messages].reverse().find((message) =>
              message.role === "user"
            );
            if (!currentRequest) {
              throw new Error("Cannot recover context without the current request");
            }
            const summary = await this.#summarizeContext(
              compaction.summarySource,
              String(currentRequest.content ?? ""),
              compaction.summaryReferences,
              config,
              options,
              budget,
              traces,
              parent,
            );
            summary.evidence = [
              ...summary.evidence,
              ...compaction.summaryReferences.map((reference) =>
                `Archived context reference: ${reference}`
              ),
            ].filter((item, index, items) => items.indexOf(item) === index);
            const summaryText = formatStructuredContextSummary(summary);
            this.#installStructuredSummary(messages, summaryText);
            await this.#persistSummaryCheckpoint(
              sessionId,
              workspace,
              persistedHistory,
              historyIndexes,
              compaction.summarySource,
              formatStructuredContextSummary({
                ...summary,
                currentGoal: "The current request is supplied separately.",
              }),
            );
          }
          const fitted = fitRequestToContextBudget(messages, tools, config, usage.contextBudget);
          if (fitted.compacted || compaction.compacted) {
            usage.contextBudget!.compactions++;
            options.onEvent?.({
              type: "hook",
              name: "ContextOverflowRecovery",
              detail:
                `recovery 1/1 · ${fitted.estimatedInputTokens}/${fitted.targetTokens} estimated tokens`,
              traceId: providerSpan.traceId,
              spanId: providerSpan.spanId,
              parentSpanId: providerSpan.parentSpanId,
            });
          }
          continue;
        }
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
          traceId: providerSpan.traceId,
          spanId: providerSpan.spanId,
          parentSpanId: providerSpan.parentSpanId,
          durationMs: providerSpan.durationMs,
          traceStatus: providerSpan.status,
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

  async #persistSummaryCheckpoint(
    sessionId: string,
    workspace: string,
    history: Message[],
    historyIndexes: ReadonlyMap<Message, number>,
    source: Message[][],
    summary: string,
  ): Promise<void> {
    const sourceMessages = source.flat();
    if (!sourceMessages.length || sourceMessages.some((message) => !historyIndexes.has(message))) {
      return;
    }
    const indexes = sourceMessages.map((message) => historyIndexes.get(message)!);
    const coveredCount = indexes.length;
    if (indexes.some((index, position) => index !== position)) return;
    await saveSummaryCheckpoint(sessionId, workspace, history, coveredCount, summary);
  }

  #recordTruncation(
    response: ChatResponse,
    budget: RuntimeBudget,
    requestType: "answer" | "summary",
    options: RunOptions,
  ): void {
    const reason = response.choices[0]?.finish_reason?.toLowerCase() ?? "";
    if (!/(length|max_tokens|max_output_tokens|token_limit)/.test(reason)) return;
    budget.tokenUsage.recordOutputTruncation(requestType, reason);
    options.onEvent?.({
      type: "hook",
      name: "OutputTruncated",
      detail: `${requestType} response reached provider output limit (${reason})`,
    });
  }

  async #summarizeContext(
    source: Message[][],
    currentRequest: string,
    references: string[],
    config: Awaited<ReturnType<typeof resolveProviderConfig>>,
    options: RunOptions,
    budget: RuntimeBudget,
    traces: TraceBook,
    parent: TraceSpan,
  ) {
    const usage = budget.tokenUsage;
    const callBudget = config.contextSummaryCallBudget ?? 1;
    if (usage.contextSummaryCalls >= callBudget) {
      throw new ContextSummaryBudgetExceededError(
        `Context summary call budget exhausted (${usage.contextSummaryCalls}/${callBudget})`,
      );
    }
    if (options.signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
    const outputBudget = config.contextSummaryOutputTokens ?? 1_200;
    const availableWindow = (config.contextWindowTokens ?? 32_768) - outputBudget -
      (config.safetyMarginTokens ?? 2_048);
    const inputBudget = Math.min(config.contextSummaryInputTokens ?? 6_000, availableWindow);
    if (inputBudget <= 0) {
      throw new ContextSummaryBudgetExceededError(
        "Context summary has no input budget in the configured model window",
      );
    }
    const messages = buildStructuredSummaryMessages(
      source,
      currentRequest,
      references,
      inputBudget,
      config.tokenEstimator,
    );
    const parts = estimateRequestComponents(messages, []);
    const inputTokens = estimateRequestInputTokens(messages, [], config.tokenEstimator);
    if (inputTokens > inputBudget) {
      throw new ContextSummaryBudgetExceededError(
        `Context summary input budget exceeded (${inputTokens}/${inputBudget})`,
      );
    }
    const providerSpan = traces.start("provider.context_summary", "provider", parent);
    let requestRecorded = false;
    let responseReceived = false;
    try {
      budget.consume("cost");
      usage.recordEstimate(parts, config.tokenEstimator);
      usage.recordContextSummaryInput(inputTokens);
      requestRecorded = true;
      const summaryConfig = { ...config, outputTokenReserve: outputBudget };
      const response = await this.#getModelProvider(config).createChatCompletion(
        summaryConfig,
        messages,
        [],
        options.signal,
        { maxOutputTokens: outputBudget },
      );
      responseReceived = true;
      usage.recordResponse(response.usage);
      this.#recordTruncation(response, budget, "summary", options);
      const content = response.choices[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Provider returned an empty structured context summary");
      }
      const outputTokens = estimateTokensFromText(content, config.tokenEstimator);
      usage.recordContextSummaryOutput(outputTokens);
      if (
        outputTokens > outputBudget ||
        (response.usage?.completion_tokens !== undefined &&
          response.usage.completion_tokens > outputBudget)
      ) {
        throw new ContextSummaryBudgetExceededError(
          `Context summary output budget exceeded (${
            Math.max(outputTokens, response.usage?.completion_tokens ?? 0)
          }/${outputBudget})`,
        );
      }
      const summary = parseStructuredContextSummary(content);
      traces.end(providerSpan, "ok");
      options.onEvent?.({
        type: "hook",
        name: "ContextSummary",
        detail:
          `call ${usage.contextSummaryCalls}/${callBudget} · input ${inputTokens} · output ${outputTokens} estimated tokens`,
        traceId: providerSpan.traceId,
        spanId: providerSpan.spanId,
        parentSpanId: providerSpan.parentSpanId,
      });
      return summary;
    } catch (error) {
      if (requestRecorded && !responseReceived) usage.recordFailure();
      traces.end(providerSpan, options.signal?.aborted ? "cancelled" : "error");
      throw error;
    }
  }

  #installStructuredSummary(messages: Message[], content: string): void {
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (
        message.role === "system" &&
        (message.content?.startsWith("[Earlier conversation block archived;") ||
          message.content?.startsWith("[Structured context summary"))
      ) messages.splice(index, 1);
    }
    const summary: Message = { role: "system", content };
    const firstNonSystem = messages.findIndex((message) => message.role !== "system");
    messages.splice(firstNonSystem < 0 ? messages.length : firstNonSystem, 0, summary);
  }
}
