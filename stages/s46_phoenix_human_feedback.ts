import { type AgentEvent, agentLoop as previousAgentLoop } from "./s45_deep_research_loop.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Span = {
  traceId: string;
  spanId: string;
  kind: "agent" | "llm" | "tool";
  name: string;
  attributes: Record<string, string | number | boolean>;
  status: "ok" | "error";
};
export type Annotation = {
  id: string;
  traceId: string;
  label: "good" | "bad" | "needs-review";
  comment: string;
  reviewer: string;
};

export class FeedbackDataset {
  readonly spans: Span[] = [];
  readonly annotations: Annotation[] = [];
  addSpan(span: Span) {
    this.spans.push(span);
  }
  annotate(annotation: Annotation) {
    if (!this.spans.some((span) => span.traceId === annotation.traceId)) {
      throw new Error("trace not found");
    }
    this.annotations.push(annotation);
  }
  metrics() {
    const errors = this.spans.filter((span) => span.status === "error").length;
    const reviewed = this.annotations.filter((item) => item.label !== "needs-review").length;
    return {
      spans: this.spans.length,
      errors,
      reviewed,
      reviewRate: this.spans.length ? reviewed / this.spans.length : 0,
    };
  }
}

export function humanEscalation(score: number, threshold = 0.7): "auto-pass" | "human-review" {
  return score >= threshold ? "auto-pass" : "human-review";
}
export function groundingCheck(answer: string, citations: string[]) {
  const missing = citations.filter((citation) => !answer.includes(citation));
  return { grounded: missing.length === 0, missing };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "phoenix_feedback_demo",
    description: "Collect trace spans, annotations, grounding results, and HITL escalation",
    parameters: {
      type: "object",
      properties: {
        answer: { type: "string" },
        citations: { type: "array" },
        score: { type: "number" },
      },
      required: ["answer", "citations", "score"],
    },
  },
};
registerTool(definition, async (input) => {
  const dataset = new FeedbackDataset();
  const traceId = crypto.randomUUID();
  dataset.addSpan({
    traceId,
    spanId: crypto.randomUUID(),
    kind: "agent",
    name: "answer",
    attributes: { score: Number(input.score) },
    status: "ok",
  });
  const grounding = groundingCheck(
    String(input.answer),
    Array.isArray(input.citations) ? input.citations.map(String) : [],
  );
  dataset.annotate({
    id: crypto.randomUUID(),
    traceId,
    label: grounding.grounded ? "good" : "needs-review",
    comment: grounding.grounded ? "grounded" : "missing citation",
    reviewer: "teaching-evaluator",
  });
  return JSON.stringify({
    grounding,
    escalation: humanEscalation(Number(input.score)),
    metrics: dataset.metrics(),
  });
});
registerSystemPromptSection({
  id: "s46-phoenix-human-feedback",
  title: "Phoenix-style observability and HITL",
  priority: 27,
  content:
    "Trace agent, model, and tool spans with redacted attributes; turn traces into datasets and annotations, run evaluators repeatedly, and escalate low-confidence or ungrounded results to a human review queue.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(humanEscalation(0.4));
  const query = prompt("s46 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
