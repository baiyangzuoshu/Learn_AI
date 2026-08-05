import { type AgentEvent, agentLoop as previousAgentLoop } from "./s71_runtime_guardrails.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type TraceContext = { traceId: string; spanId: string; parentSpanId?: string };
export type Span = {
  context: TraceContext;
  name: string;
  attributes: Record<string, string | number | boolean>;
  durationMs: number;
};
export interface SpanSink {
  record(span: Span): void;
}
export class MemorySpanSink implements SpanSink {
  readonly spans: Span[] = [];
  record(span: Span) {
    this.spans.push(span);
  }
}

export function childContext(parent?: TraceContext): TraceContext {
  return {
    traceId: parent?.traceId ?? crypto.randomUUID(),
    spanId: crypto.randomUUID().slice(0, 16),
    parentSpanId: parent?.spanId,
  };
}

export function validateObject(
  value: unknown,
  schema: { required?: string[]; properties?: Record<string, { type: string }> },
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["value must be an object"];
  }
  const object = value as Record<string, unknown>, errors: string[] = [];
  for (const key of schema.required ?? []) if (!(key in object)) errors.push(`missing ${key}`);
  for (const [key, rule] of Object.entries(schema.properties ?? {})) {
    if (key in object && typeof object[key] !== rule.type) {
      errors.push(`${key} must be ${rule.type}`);
    }
  }
  return errors;
}

export async function invokeTypedTool<T>(
  name: string,
  input: unknown,
  schema: { required?: string[]; properties?: Record<string, { type: string }> },
  handler: (input: T, context: TraceContext) => Promise<string>,
  sink: SpanSink,
  parent?: TraceContext,
) {
  const errors = validateObject(input, schema);
  if (errors.length) throw new Error(`schema validation failed: ${errors.join(", ")}`);
  const context = childContext(parent), started = performance.now();
  try {
    const output = await handler(input as T, context);
    return output;
  } finally {
    sink.record({
      context,
      name,
      attributes: { "tool.name": name },
      durationMs: Math.round(performance.now() - started),
    });
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "schema_trace_context",
    description: "Validate tool input and record a parent-linked trace span",
    parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
  },
};
registerTool(definition, async (input) => {
  const sink = new MemorySpanSink();
  const output = await invokeTypedTool<{ value: string }>(
    "lesson.echo",
    input,
    { required: ["value"], properties: { value: { type: "string" } } },
    async (value, context) => `${value.value}:${context.spanId}`,
    sink,
  );
  return JSON.stringify({ output, spans: sink.spans });
});
registerSystemPromptSection({
  id: "s72-schema-trace",
  title: "Schema validation and trace context",
  priority: 53,
  content:
    "Validate tool inputs before execution and propagate trace/span context across model, tool, MCP, nested Agent, and scheduler boundaries.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s72 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
