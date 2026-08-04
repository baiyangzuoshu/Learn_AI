import { type AgentEvent, agentLoop as boundedAgentLoop } from "./s21_bounded_runtime.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

export interface TraceRecord {
  runId: string;
  sequence: number;
  timestamp: string;
  type: "tool" | "hook";
  name: string;
  detail: string;
}

const summarizeDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "trace_summarize",
    description: "Summarize a bounded list of structured Agent trace records",
    parameters: {
      type: "object",
      properties: { records: { type: "array" } },
      required: ["records"],
    },
  },
};
registerTool(summarizeDefinition, async (input) => {
  if (!Array.isArray(input.records) || input.records.length > 1_000) {
    throw new Error("records must be an array with at most 1000 items");
  }
  const records = input.records as Array<Record<string, unknown>>;
  const counts: Record<string, number> = {};
  for (const record of records) {
    const name = String(record.name ?? "unknown");
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return JSON.stringify({ total: records.length, counts });
});
registerSystemPromptSection({
  id: "s22-structured-tracing",
  title: "Structured tracing",
  priority: 3,
  content:
    "Treat every run as a trace with ordered tool and hook records. Preserve parent-child causality, bound trace detail, and never include secrets in trace attributes.",
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
): Promise<string> {
  const runId = `run-${crypto.randomUUID()}`;
  const started = performance.now();
  let sequence = 0;
  const emit = (type: TraceRecord["type"], name: string, detail: string) => {
    const record: TraceRecord = {
      runId,
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      type,
      name,
      detail: detail.slice(0, 2_000),
    };
    onHook({ name: "TraceRecord", detail: JSON.stringify(record) });
  };
  emit("hook", "RunStarted", query.slice(0, 200));
  try {
    const answer = await boundedAgentLoop(
      query,
      (event) => {
        emit("tool", event.name, `${event.input.length} input · ${event.output.length} output`);
        onEvent(event);
      },
      model,
      history,
      permissionMode,
      signal,
      (event) => {
        emit("hook", event.name, event.detail);
        onHook(event);
      },
    );
    emit("hook", "RunCompleted", `${Math.round(performance.now() - started)}ms`);
    return answer;
  } catch (error) {
    emit("hook", "RunFailed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

if (import.meta.main) {
  const query = prompt("s22 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
