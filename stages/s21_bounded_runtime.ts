import { type AgentEvent, agentLoop as comprehensiveAgentLoop } from "./s20_comprehensive.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

export interface RunBudget {
  maxToolCalls: number;
  timeoutMs: number;
}

const DEFAULT_BUDGET: RunBudget = { maxToolCalls: 24, timeoutMs: 120_000 };
const budgetDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "runtime_budget_check",
    description: "Validate bounded Agent runtime limits before starting a long task",
    parameters: {
      type: "object",
      properties: {
        max_tool_calls: { type: "number" },
        timeout_ms: { type: "number" },
      },
      required: ["max_tool_calls", "timeout_ms"],
    },
  },
};

function normalizeBudget(input: Record<string, unknown>): RunBudget {
  const maxToolCalls = Math.floor(Number(input.max_tool_calls));
  const timeoutMs = Math.floor(Number(input.timeout_ms));
  if (maxToolCalls < 1 || maxToolCalls > 100) throw new Error("max_tool_calls must be 1–100");
  if (timeoutMs < 1_000 || timeoutMs > 3_600_000) {
    throw new Error("timeout_ms must be 1000–3600000");
  }
  return { maxToolCalls, timeoutMs };
}

registerTool(budgetDefinition, async (input) => JSON.stringify(normalizeBudget(input)));
registerSystemPromptSection({
  id: "s21-bounded-runtime",
  title: "Bounded runtime",
  priority: 2,
  content:
    "Every run has explicit time and tool-call budgets. Stop on cancellation or budget exhaustion, report the exhausted limit, and never rely on the model to stop itself.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
  budget: RunBudget = DEFAULT_BUDGET,
): Promise<string> {
  const limits = normalizeBudget({
    max_tool_calls: budget.maxToolCalls,
    timeout_ms: budget.timeoutMs,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("runtime timeout"), limits.timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  let toolCalls = 0;
  onHook({
    name: "RuntimeBudgetStarted",
    detail: `${limits.maxToolCalls} tools · ${limits.timeoutMs}ms`,
  });
  try {
    return await comprehensiveAgentLoop(
      query,
      (event) => {
        toolCalls++;
        onEvent(event);
        if (toolCalls >= limits.maxToolCalls) controller.abort("tool-call budget exhausted");
      },
      model,
      history,
      permissionMode,
      controller.signal,
      onHook,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    onHook({ name: "RuntimeBudgetStopped", detail: `${toolCalls} tool calls` });
  }
}

if (import.meta.main) {
  const query = prompt("s21 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
