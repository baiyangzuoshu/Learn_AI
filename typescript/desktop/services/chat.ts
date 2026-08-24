import {
  type AgentEvent,
  agentLoop,
  type EvaluationRecord,
  type HandoffRecord,
  type PermissionMode,
  type ResearchRecord,
  type RunBudgetSnapshot,
  type TaskRecord,
  type TraceSummary,
  type WorkerJob,
} from "../../src/mod.ts";

export type ChatRequest = {
  message?: string;
  providerId?: string;
  model?: string;
  permissionMode?: PermissionMode;
  developerMode?: boolean;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function runChat(body: ChatRequest): Promise<{
  answer: string;
  events: AgentEvent[];
  budget?: RunBudgetSnapshot;
  trace?: TraceSummary;
  task?: TaskRecord;
  worker?: WorkerJob;
  handoff?: HandoffRecord;
  research?: ResearchRecord;
  evaluation?: EvaluationRecord;
}> {
  if (!body.message?.trim()) throw new Error("message is required");
  const events: AgentEvent[] = [];
  let budget: RunBudgetSnapshot | undefined;
  let trace: TraceSummary | undefined;
  let task: TaskRecord | undefined;
  let worker: WorkerJob | undefined;
  let handoff: HandoffRecord | undefined;
  let research: ResearchRecord | undefined;
  let evaluation: EvaluationRecord | undefined;
  const answer = await agentLoop(
    body.message,
    (event) => events.push(event),
    body.model,
    body.history ?? [],
    body.permissionMode ?? "ask",
    undefined,
    (event) => {
      if (event.name === "RunUsage") {
        try {
          budget = JSON.parse(event.detail ?? "") as RunBudgetSnapshot;
        } catch { /* ignore malformed developer detail */ }
      }
      if (event.name === "TraceSummary") {
        try {
          trace = JSON.parse(event.detail ?? "") as TraceSummary;
        } catch { /* ignore malformed trace details */ }
      }
      if (event.name === "TaskState") {
        try {
          task = (JSON.parse(event.detail ?? "{}").task ?? undefined) as TaskRecord | undefined;
        } catch { /* ignore malformed task state details */ }
      }
      if (event.name === "WorkerState") {
        try {
          worker = (JSON.parse(event.detail ?? "{}").worker ?? undefined) as WorkerJob | undefined;
        } catch { /* ignore malformed worker state details */ }
      }
      if (event.name === "HandoffState") {
        try {
          handoff = (JSON.parse(event.detail ?? "{}").handoff ?? undefined) as
            | HandoffRecord
            | undefined;
        } catch { /* ignore malformed handoff state details */ }
      }
      if (event.name === "ResearchState") {
        try {
          research = (JSON.parse(event.detail ?? "{}").research ?? undefined) as
            | ResearchRecord
            | undefined;
        } catch { /* ignore malformed research state details */ }
      }
      if (event.name === "EvaluationState") {
        try {
          evaluation = (JSON.parse(event.detail ?? "{}").evaluation ?? undefined) as
            | EvaluationRecord
            | undefined;
        } catch { /* ignore malformed evaluation state details */ }
      }
    },
    body.providerId,
  );
  return { answer, events, budget, trace, task, worker, handoff, research, evaluation };
}

export function createChatStream(body: ChatRequest): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let streamClosed = false;
  return new ReadableStream({
    start(controller) {
      const emit = (data: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        } catch {
          streamClosed = true;
          abortController.abort();
        }
      };
      const close = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch { /* consumer already disconnected */ }
      };
      emit({ type: "status", message: "正在分析任务…" });
      agentLoop(
        body.message ?? "",
        (event) => emit({ type: "tool", event }),
        body.model,
        body.history ?? [],
        body.permissionMode ?? "ask",
        abortController.signal,
        (event) => {
          if (event.name === "RunUsage") {
            try {
              emit({ type: "budget", usage: JSON.parse(event.detail ?? "") });
            } catch { /* ignore malformed usage details */ }
          }
          if (event.name === "TraceSummary") {
            try {
              emit({ type: "trace", summary: JSON.parse(event.detail ?? "") });
            } catch { /* ignore malformed trace details */ }
          }
          if (event.name === "TaskState") {
            try {
              emit({ type: "task", task: JSON.parse(event.detail ?? "{}").task });
            } catch { /* ignore malformed task state details */ }
          }
          if (event.name === "WorkerState") {
            try {
              emit({ type: "worker", worker: JSON.parse(event.detail ?? "{}").worker ?? null });
            } catch { /* ignore malformed worker state details */ }
          }
          if (event.name === "HandoffState") {
            try {
              emit({ type: "handoff", handoff: JSON.parse(event.detail ?? "{}").handoff ?? null });
            } catch { /* ignore malformed handoff state details */ }
          }
          if (event.name === "ResearchState") {
            try {
              emit({
                type: "research",
                research: JSON.parse(event.detail ?? "{}").research ?? null,
              });
            } catch { /* ignore malformed research state details */ }
          }
          if (event.name === "EvaluationState") {
            try {
              emit({
                type: "evaluation",
                evaluation: JSON.parse(event.detail ?? "{}").evaluation ?? null,
              });
            } catch { /* ignore malformed evaluation state details */ }
          }
          if (
            body.developerMode &&
            event.name !== "RunUsage" &&
            event.name !== "TraceSummary" &&
            event.name !== "TaskState" &&
            event.name !== "WorkerState" &&
            event.name !== "HandoffState" &&
            event.name !== "ResearchState" &&
            event.name !== "EvaluationState"
          ) {
            emit({ type: "hook", event });
          }
        },
        body.providerId,
      ).then((answer) => {
        emit({ type: "status", message: "正在组织答案…" });
        emit({ type: "answer", answer });
        emit({ type: "done" });
        close();
      }).catch((error) => {
        emit({ type: "error", error: error instanceof Error ? error.message : String(error) });
        close();
      });
    },
    cancel() {
      streamClosed = true;
      abortController.abort();
    },
  });
}
