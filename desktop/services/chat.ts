import {
  type AgentEvent,
  agentLoop,
  type PermissionMode,
  type RunBudgetSnapshot,
  type TaskRecord,
  type TraceSummary,
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
}> {
  if (!body.message?.trim()) throw new Error("message is required");
  const events: AgentEvent[] = [];
  let budget: RunBudgetSnapshot | undefined;
  let trace: TraceSummary | undefined;
  let task: TaskRecord | undefined;
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
    },
    body.providerId,
  );
  return { answer, events, budget, trace, task };
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
          if (
            body.developerMode &&
            event.name !== "RunUsage" &&
            event.name !== "TraceSummary" &&
            event.name !== "TaskState"
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
