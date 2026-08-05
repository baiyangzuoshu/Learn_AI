import { type AgentEvent, agentLoop as previousAgentLoop } from "./s30_production_readiness.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type JsonSchema = {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};

export function validateSchema(value: unknown, schema: JsonSchema, path = "$"): string[] {
  const errors: string[] = [];
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (actual !== schema.type) return [`${path}: expected ${schema.type}, got ${actual}`];
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return errors;
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key}: required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record) errors.push(...validateSchema(record[key], child, `${path}.${key}`));
    }
  }
  if (schema.type === "array" && schema.items && Array.isArray(value)) {
    value.forEach((item, index) =>
      errors.push(...validateSchema(item, schema.items!, `${path}[${index}]`))
    );
  }
  return errors;
}

export function parseStructuredOutput(text: string, schema: JsonSchema): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("model output is not valid JSON");
  }
  const errors = validateSchema(value, schema);
  if (errors.length) throw new Error(`schema validation failed: ${errors.join("; ")}`);
  return value;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "structured_output_validate",
    description: "Validate model JSON against a small teaching schema",
    parameters: {
      type: "object",
      properties: { json: { type: "string" }, schema: { type: "object" } },
      required: ["json", "schema"],
    },
  },
};
registerTool(definition, async (input) => {
  const result = parseStructuredOutput(String(input.json), input.schema as JsonSchema);
  return JSON.stringify({ valid: true, value: result });
});
registerSystemPromptSection({
  id: "s31-structured-io",
  title: "Structured input and output",
  priority: 12,
  content:
    "When a downstream step needs data, request a schema-conforming JSON object. Parse and validate before executing side effects; a natural-language answer is not a substitute for a contract.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history = [],
  permissionMode = "ask" as const,
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
) {
  return await previousAgentLoop(query, onEvent, model, history, permissionMode, signal, onHook);
}

if (import.meta.main) {
  console.log(validateSchema({ answer: "ok" }, {
    type: "object",
    properties: { answer: { type: "string" } },
    required: ["answer"],
  }));
  const query = prompt("s31 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
