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
import { taskState } from "./features/task_state.ts";
import { workerQueue } from "./features/worker_queue.ts";
import { handoff } from "./features/handoff.ts";
import { memoryRag } from "./features/memory_rag.ts";
import { research } from "./features/research.ts";
import { evaluation } from "./features/evaluation.ts";
import { securityBoundary } from "./features/security_boundary.ts";
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
  taskState,
  workerQueue,
  handoff,
  memoryRag,
  research,
  evaluation,
  securityBoundary,
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
export { checkpointTask, createTask, resumeTask, verifyTask } from "./task_ledger.ts";
export type { TaskEvidence, TaskRecord, TaskState } from "./task_ledger.ts";
export {
  completeHandoff,
  failHandoff,
  readHandoffs,
  submitHandoff,
  transferHandoff,
} from "./handoff.ts";
export type {
  HandoffEvidence,
  HandoffRecord,
  HandoffState,
  HandoffSubmitInput,
} from "./handoff.ts";
export {
  legacyMemoryTenant,
  migrateLegacyMemory,
  readMemoryRecords,
  replaceMemory,
  searchMemory,
  tombstoneMemory,
  writeMemory,
} from "./memory_service.ts";
export {
  addResearchSource,
  readResearch,
  startResearch,
  synthesizeResearch,
} from "./research_service.ts";
export { readEvaluations, runEvaluation } from "./evaluation_service.ts";
export type {
  EvaluationCase,
  EvaluationRecord,
  EvaluationResult,
  EvaluationRunInput,
  EvaluationState,
} from "./evaluation_service.ts";
export { checkSecurityBoundary, readSecurityAudit, redactSecrets } from "./security_boundary.ts";
export type { SecurityAuditEntry, SecurityCheckInput } from "./security_boundary.ts";
export type {
  ResearchRecord,
  ResearchSource,
  ResearchSourceInput,
  ResearchStartInput,
  ResearchState,
} from "./research_service.ts";
export type {
  MemoryCitation,
  MemoryHit,
  MemoryKind,
  MemoryRecord,
  MemoryWriteInput,
} from "./memory_service.ts";
export { mcpSessionManager, shutdownMcpSessions } from "./mcp.ts";
export type {
  McpRequest,
  McpServerConfig,
  McpSessionStatus,
  McpTransport,
  McpTransportFactory,
  McpTransportKind,
} from "./mcp.ts";
export {
  enqueueWorkerJob,
  leaseWorkerJob,
  readWorkerJobs,
  settleWorkerJob,
} from "./worker_queue.ts";
export type { WorkerJob, WorkerJobStatus } from "./worker_queue.ts";
