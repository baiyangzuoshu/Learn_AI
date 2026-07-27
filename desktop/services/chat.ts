import { type AgentEvent, agentLoop, type PermissionMode } from "../../src/harness/mod.ts";

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
}> {
  if (!body.message?.trim()) throw new Error("message is required");
  const events: AgentEvent[] = [];
  const answer = await agentLoop(
    body.message,
    (event) => events.push(event),
    body.model,
    body.history ?? [],
    body.permissionMode ?? "ask",
    undefined,
    undefined,
    body.providerId,
  );
  return { answer, events };
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
          if (body.developerMode) emit({ type: "hook", event });
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
