import type { Message, ToolDefinition } from "./core/types.ts";

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
}

export type RunBudget = {
  iterations: number;
  toolCalls: number;
  outputChars: number;
  cost: number;
};

export type BudgetKind = keyof RunBudget;

export interface RunBudgetSnapshot {
  used: RunBudget;
  limit: RunBudget;
  remaining: RunBudget;
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

  constructor(limit: Readonly<RunBudget>, private readonly parent?: RuntimeBudget) {
    this.limit = resolveRunBudget(limit);
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
  signal?: AbortSignal;
  budget: RuntimeBudget;
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
}
export interface PromptSection {
  id: string;
  title: string;
  content: string;
  priority: number;
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
  register(
    context: {
      tools: ToolRegistryContract;
      prompts: PromptRegistryContract;
      run: (options: RunOptions) => Promise<string>;
    },
  ): void;
}
export interface ToolRegistryContract {
  register(definition: ToolDefinition, handler: ToolHandler, policy?: Partial<ToolPolicy>): void;
}
export interface PromptRegistryContract {
  register(section: PromptSection): void;
}
