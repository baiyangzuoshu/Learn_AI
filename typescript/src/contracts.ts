import type { Message, ProviderTokenUsage, ToolDefinition } from "./core/types.ts";

export type PermissionMode = "ask" | "auto" | "full";

export type ToolRisk = "read-only" | "mutating" | "external" | "dangerous";

export interface ToolPolicy {
  name: string;
  mutation: boolean;
  risk: ToolRisk;
  scopes: string[];
  maxOutput: number;
}

export interface Principal {
  id: string;
  scopes: ReadonlySet<string>;
  expiresAt: number;
  subject?: string;
  tenant?: string;
}

export type RunBudget = {
  iterations: number;
  toolCalls: number;
  outputChars: number;
  /** Compatibility field: counts attempted provider API requests; monetary cost is tracked separately. */
  cost: number;
};

export type BudgetKind = keyof RunBudget;

export interface RunBudgetSnapshot {
  used: RunBudget;
  limit: RunBudget;
  remaining: RunBudget;
}

export type TokenInputComponent =
  | "systemPrompt"
  | "toolDefinitions"
  | "conversation"
  | "toolResults";

export interface TokenUsageSnapshot {
  requests: number;
  failedRequests: number;
  successfulResponses: number;
  responsesWithoutUsage: number;
  estimatedInput: {
    chars: number;
    tokens: number;
    byComponent: Record<TokenInputComponent, { chars: number; tokens: number }>;
    largestComponent: TokenInputComponent | null;
  };
  actual: {
    available: boolean;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
  };
  contextSummary: {
    calls: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };
  output: {
    truncatedResponses: number;
    lastTruncation: { requestType: "answer" | "summary"; finishReason: string } | null;
  };
  contextReduction: {
    requests: number;
    lastTokens: number;
    totalTokens: number;
  };
  contextOverflowRecoveries: number;
  contextBudget?: ContextBudgetSnapshot;
}

export interface ContextBudgetSnapshot {
  contextWindowTokens: number;
  outputTokenReserve: number;
  safetyMarginTokens: number;
  inputBudgetTokens: number;
  compactionTargetTokens: number;
  lastEstimatedInputTokens: number;
  compactions: number;
}

const TOKEN_COMPONENTS: TokenInputComponent[] = [
  "systemPrompt",
  "toolDefinitions",
  "conversation",
  "toolResults",
];

/** Per-run token accounting shared by bounded child runs. */
export class RunTokenUsage {
  requests = 0;
  failedRequests = 0;
  successfulResponses = 0;
  responsesWithoutUsage = 0;
  readonly estimatedChars: Record<TokenInputComponent, number> = {
    systemPrompt: 0,
    toolDefinitions: 0,
    conversation: 0,
    toolResults: 0,
  };
  readonly estimatedTokens: Record<TokenInputComponent, number> = {
    systemPrompt: 0,
    toolDefinitions: 0,
    conversation: 0,
    toolResults: 0,
  };
  actualAvailable = false;
  actualInputTokens = 0;
  actualOutputTokens = 0;
  actualTotalTokens = 0;
  cacheHitTokens = 0;
  cacheMissTokens = 0;
  contextSummaryCalls = 0;
  contextSummaryInputTokens = 0;
  contextSummaryOutputTokens = 0;
  truncatedResponses = 0;
  lastTruncation: TokenUsageSnapshot["output"]["lastTruncation"] = null;
  contextReductionRequests = 0;
  lastContextReductionTokens = 0;
  totalContextReductionTokens = 0;
  contextOverflowRecoveries = 0;
  contextBudget?: ContextBudgetSnapshot;

  recordEstimate(
    parts: Record<TokenInputComponent, string>,
    estimator: "multilingual-v1" | "conservative-v1" = "conservative-v1",
  ): void {
    this.requests++;
    for (const component of TOKEN_COMPONENTS) {
      const text = parts[component];
      this.estimatedChars[component] += text.length;
      this.estimatedTokens[component] += estimateTokensFromText(text, estimator);
    }
  }

  recordFailure(): void {
    this.failedRequests++;
  }

  recordContextSummaryInput(inputTokens: number): void {
    this.contextSummaryCalls++;
    this.contextSummaryInputTokens += Math.max(0, Math.floor(inputTokens));
  }

  recordContextSummaryOutput(outputTokens: number): void {
    this.contextSummaryOutputTokens += Math.max(0, Math.floor(outputTokens));
  }

  recordOutputTruncation(
    requestType: "answer" | "summary",
    finishReason: string,
  ): void {
    this.truncatedResponses++;
    this.lastTruncation = { requestType, finishReason };
  }

  recordContextReduction(tokens: number): void {
    const reduction = Math.max(0, Math.floor(tokens));
    this.contextReductionRequests++;
    this.lastContextReductionTokens = reduction;
    this.totalContextReductionTokens += reduction;
  }

  recordResponse(usage?: ProviderTokenUsage): void {
    this.successfulResponses++;
    const tokenFields = usage && [
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.total_tokens,
      usage.prompt_cache_hit_tokens,
      usage.prompt_cache_miss_tokens,
    ];
    if (!tokenFields || tokenFields.every((value) => value === undefined)) {
      this.responsesWithoutUsage++;
      return;
    }
    this.actualAvailable = true;
    this.actualInputTokens += usage.prompt_tokens ?? 0;
    this.actualOutputTokens += usage.completion_tokens ?? 0;
    this.actualTotalTokens += usage.total_tokens ??
      (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
    this.cacheHitTokens += usage.prompt_cache_hit_tokens ?? 0;
    this.cacheMissTokens += usage.prompt_cache_miss_tokens ?? 0;
  }

  snapshot(): TokenUsageSnapshot {
    const byComponent = Object.fromEntries(TOKEN_COMPONENTS.map((component) => {
      const chars = this.estimatedChars[component];
      return [component, { chars, tokens: this.estimatedTokens[component] }];
    })) as Record<TokenInputComponent, { chars: number; tokens: number }>;
    const largestComponent = TOKEN_COMPONENTS.reduce<TokenInputComponent | null>(
      (largest, component) =>
        largest === null ||
          byComponent[component].tokens > byComponent[largest].tokens
          ? component
          : largest,
      null,
    );
    const inputChars = TOKEN_COMPONENTS.reduce(
      (sum, component) => sum + this.estimatedChars[component],
      0,
    );
    return {
      requests: this.requests,
      failedRequests: this.failedRequests,
      successfulResponses: this.successfulResponses,
      responsesWithoutUsage: this.responsesWithoutUsage,
      estimatedInput: {
        chars: inputChars,
        tokens: TOKEN_COMPONENTS.reduce(
          (sum, component) => sum + this.estimatedTokens[component],
          0,
        ),
        byComponent,
        largestComponent,
      },
      actual: {
        available: this.actualAvailable,
        inputTokens: this.actualInputTokens,
        outputTokens: this.actualOutputTokens,
        totalTokens: this.actualTotalTokens,
        cacheHitTokens: this.cacheHitTokens,
        cacheMissTokens: this.cacheMissTokens,
      },
      contextSummary: {
        calls: this.contextSummaryCalls,
        estimatedInputTokens: this.contextSummaryInputTokens,
        estimatedOutputTokens: this.contextSummaryOutputTokens,
      },
      output: {
        truncatedResponses: this.truncatedResponses,
        lastTruncation: this.lastTruncation ? { ...this.lastTruncation } : null,
      },
      contextReduction: {
        requests: this.contextReductionRequests,
        lastTokens: this.lastContextReductionTokens,
        totalTokens: this.totalContextReductionTokens,
      },
      contextOverflowRecoveries: this.contextOverflowRecoveries,
      ...(this.contextBudget ? { contextBudget: { ...this.contextBudget } } : {}),
    };
  }
}

/** Rough multilingual estimate for providers that do not expose tokenization locally. */
export function estimateTokensFromText(
  text: string,
  estimator: "multilingual-v1" | "conservative-v1" = "conservative-v1",
): number {
  if (estimator === "conservative-v1") return text.length;
  let cjk = 0, other = 0;
  for (const char of text) {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(char)) {
      cjk++;
    } else other++;
  }
  return Math.ceil(cjk * 1.5 + other / 4);
}

export const DEFAULT_RUN_BUDGET: Readonly<RunBudget> = Object.freeze({
  iterations: 40,
  toolCalls: 80,
  outputChars: 250_000,
  cost: 40,
});

function validateLimit(kind: BudgetKind, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${kind} budget must be a non-negative finite number`);
  }
  return value;
}

export function resolveRunBudget(value?: Partial<RunBudget>): RunBudget {
  const resolved = { ...DEFAULT_RUN_BUDGET, ...value };
  for (const kind of Object.keys(resolved) as BudgetKind[]) {
    resolved[kind] = validateLimit(kind, resolved[kind]);
  }
  return resolved;
}

export class BudgetExceededError extends Error {
  constructor(
    readonly kind: BudgetKind,
    readonly used: number,
    readonly limit: number,
  ) {
    super(`${kind} budget exceeded (${used}/${limit})`);
    this.name = "BudgetExceededError";
  }
}

export class RuntimeBudget {
  readonly used: RunBudget = { iterations: 0, toolCalls: 0, outputChars: 0, cost: 0 };
  readonly limit: RunBudget;

  readonly tokenUsage: RunTokenUsage;

  constructor(limit: Readonly<RunBudget>, private readonly parent?: RuntimeBudget) {
    this.limit = resolveRunBudget(limit);
    this.tokenUsage = parent?.tokenUsage ?? new RunTokenUsage();
  }

  consume(kind: BudgetKind, amount = 1): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`${kind} budget consumption must be a non-negative finite number`);
    }
    const next = this.used[kind] + amount;
    if (next > this.limit[kind]) throw new BudgetExceededError(kind, next, this.limit[kind]);
    this.parent?.consume(kind, amount);
    this.used[kind] = next;
  }

  child(limit: Partial<RunBudget> = {}): RuntimeBudget {
    const remaining = this.remaining();
    const childLimit = resolveRunBudget({ ...remaining, ...limit });
    for (const kind of Object.keys(childLimit) as BudgetKind[]) {
      childLimit[kind] = Math.min(childLimit[kind], remaining[kind]);
    }
    return new RuntimeBudget(childLimit, this);
  }

  remaining(): RunBudget {
    return {
      iterations: Math.max(0, this.limit.iterations - this.used.iterations),
      toolCalls: Math.max(0, this.limit.toolCalls - this.used.toolCalls),
      outputChars: Math.max(0, this.limit.outputChars - this.used.outputChars),
      cost: Math.max(0, this.limit.cost - this.used.cost),
    };
  }

  snapshot(): RunBudgetSnapshot {
    return { used: { ...this.used }, limit: { ...this.limit }, remaining: this.remaining() };
  }
}

export interface ToolContext {
  workspace: string;
  sessionId: string;
  signal?: AbortSignal;
  budget: RuntimeBudget;
  tokenUsage: RunTokenUsage;
  principal?: Principal;
  activateCapability?: (id: string) => CapabilityDefinition;
}
export interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResult {
  name: string;
  input: string;
  output: string;
}
export type ToolHandler = (input: Record<string, unknown>, context: ToolContext) => Promise<string>;
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
  policy: ToolPolicy;
  group: string;
  deprecated: boolean;
}
export interface CapabilityDefinition {
  id: string;
  title: string;
  description: string;
  alwaysAvailable?: boolean;
}
export interface ToolRegistrationMetadata {
  group?: string;
  deprecated?: boolean;
}
export interface PromptSection {
  id: string;
  title: string;
  content: string;
  priority: number;
  group?: string;
}
export interface HarnessEvent {
  type: "tool" | "hook";
  name: string;
  detail?: string;
  input?: string;
  output?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  durationMs?: number;
  traceStatus?: "ok" | "error" | "cancelled";
}
export interface RunOptions {
  query: string;
  sessionId?: string;
  providerId?: string;
  model?: string;
  history?: Message[];
  workspace?: string;
  permissionMode?: PermissionMode;
  principal?: Principal;
  signal?: AbortSignal;
  budget?: Partial<RunBudget> | RuntimeBudget;
  onEvent?: (event: HarnessEvent) => void;
}
export interface HarnessFeature {
  id: string;
  capability?: CapabilityDefinition;
  register(
    context: {
      tools: ToolRegistryContract;
      prompts: PromptRegistryContract;
      run: (options: RunOptions) => Promise<string>;
    },
  ): void;
}
export interface ToolRegistryContract {
  register(
    definition: ToolDefinition,
    handler: ToolHandler,
    policy?: Partial<ToolPolicy>,
    metadata?: ToolRegistrationMetadata,
  ): void;
}
export interface PromptRegistryContract {
  register(section: PromptSection): void;
}
