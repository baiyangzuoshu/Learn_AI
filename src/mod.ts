import { AgentRuntime } from "./runtime.ts";
import { coreTools } from "./features/core_tools.ts";
import { productivity } from "./features/productivity.ts";
import { orchestration } from "./features/orchestration.ts";
import { integrations } from "./features/integrations.ts";
import { diagnostics } from "./features/diagnostics.ts";
import { scheduling } from "./features/scheduling.ts";
import { runtimeLimits } from "./features/runtime_limits.ts";
import { pdfReader } from "./features/pdf_reader.ts";
import { imageGeneration } from "./features/image_generation.ts";
import { toolPolicy } from "./features/tool_policy.ts";
import type { Message } from "./core/types.ts";
import type { HarnessEvent, PermissionMode, RunOptions } from "./contracts.ts";

export const harness = new AgentRuntime([
  diagnostics,
  runtimeLimits,
  pdfReader,
  coreTools,
  productivity,
  orchestration,
  integrations,
  imageGeneration,
  toolPolicy,
  scheduling,
]);
export const runAgent = harness.run.bind(harness);
export interface AgentEvent {
  type: "tool";
  name: string;
  input: string;
  output: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  durationMs?: number;
  traceStatus?: "ok" | "error" | "cancelled";
}
//主循环
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask", //权限
  signal?: AbortSignal,
  onHook: (event: HarnessEvent) => void = () => {},
  providerId?: string,
  budget?: RunOptions["budget"],
  principal?: RunOptions["principal"],
): Promise<string> {
  return await harness.run({
    query,
    providerId,
    model,
    history,
    permissionMode,
    signal,
    budget,
    principal,
    onEvent(event) {
      if (event.type === "tool") {
        onEvent({
          type: "tool",
          name: event.name,
          input: event.input ?? "",
          output: event.output ?? "",
          traceId: event.traceId,
          spanId: event.spanId,
          parentSpanId: event.parentSpanId,
          durationMs: event.durationMs,
          traceStatus: event.traceStatus,
        });
      } else onHook(event);
    },
  });
}
export type {
  HarnessEvent,
  PermissionMode,
  Principal,
  RunBudget,
  RunBudgetSnapshot,
  RunOptions,
} from "./contracts.ts";
export type { ToolPolicy, ToolRisk } from "./contracts.ts";
export {
  BudgetExceededError,
  DEFAULT_RUN_BUDGET,
  resolveRunBudget,
  RuntimeBudget,
} from "./contracts.ts";
export { TraceBook } from "./trace.ts";
export type { TraceSpan, TraceStatus, TraceSummary } from "./trace.ts";
export {
  authorizeToolPolicy,
  boundedToolOutput,
  createPrincipal,
  DEFAULT_TOOL_OUTPUT,
  normalizeToolPolicy,
  PRINCIPAL_TTL_MS,
  ToolPolicyError,
} from "./tool_policy.ts";
export { listCronSchedules, runCronSchedule, saveCronSchedules } from "./scheduler.ts";
