import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import {
  addResearchSource,
  readResearch,
  startResearch,
  synthesizeResearch,
} from "../research_service.ts";
import type { ResearchRecord } from "../research_service.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

function compact(record: ResearchRecord): Record<string, unknown> {
  return {
    id: record.id,
    tenant: record.tenant,
    query: record.query,
    traceId: record.traceId,
    state: record.state,
    confidence: record.confidence,
    minConfidence: record.minConfidence,
    citations: record.citations.slice(0, 20),
    sources: record.sources.slice(-20).map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      fetchedAt: source.fetchedAt,
      quality: source.quality,
      fresh: source.fresh,
      text: source.text.slice(0, 800),
    })),
    answer: record.answer?.slice(0, 8_000),
    escalationReason: record.escalationReason,
    revision: record.revision,
    updatedAt: record.updatedAt,
  };
}

function output(record: ResearchRecord): string {
  return JSON.stringify({
    research: compact(record),
    escalated: record.state === "escalated",
    citations: record.citations,
  });
}

export const research: HarnessFeature = {
  id: "grounded-research",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "research_start",
        "Create a tenant-scoped, trace-linked grounded research task",
        {
          tenant: { type: "string" },
          query: { type: "string" },
          trace_id: { type: "string" },
          max_sources: { type: "integer", minimum: 1, maximum: 20 },
          freshness_hours: { type: "integer", minimum: 1, maximum: 720 },
          min_confidence: { type: "number", minimum: 0.1, maximum: 0.99 },
          idempotency_key: { type: "string" },
        },
        ["tenant", "query"],
      ),
      async (input, context) =>
        output(
          await startResearch(context.workspace, {
            tenant: String(input.tenant ?? ""),
            query: String(input.query ?? ""),
            traceId: typeof input.trace_id === "string" ? input.trace_id : undefined,
            maxSources: typeof input.max_sources === "number" ? input.max_sources : undefined,
            freshnessHours: typeof input.freshness_hours === "number"
              ? input.freshness_hours
              : undefined,
            minConfidence: typeof input.min_confidence === "number"
              ? input.min_confidence
              : undefined,
            idempotencyKey: typeof input.idempotency_key === "string"
              ? input.idempotency_key
              : undefined,
          }, context.signal),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition(
        "research_add_source",
        "Attach one bounded, quality-scored source to a research task",
        {
          id: { type: "string" },
          tenant: { type: "string" },
          url: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          fetched_at: { type: "string" },
          quality: { type: "number", minimum: 0, maximum: 1 },
          idempotency_key: { type: "string" },
        },
        ["id", "tenant", "url", "title", "text", "fetched_at"],
      ),
      async (input, context) =>
        output(
          await addResearchSource(
            context.workspace,
            String(input.id ?? ""),
            {
              tenant: String(input.tenant ?? ""),
              url: String(input.url ?? ""),
              title: String(input.title ?? ""),
              text: String(input.text ?? ""),
              fetchedAt: String(input.fetched_at ?? ""),
              quality: typeof input.quality === "number" ? input.quality : undefined,
              idempotencyKey: typeof input.idempotency_key === "string"
                ? input.idempotency_key
                : undefined,
            },
            context.signal,
          ),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition(
        "grounded_research",
        "Synthesize only fresh, quality-scored sources with citations",
        {
          id: { type: "string" },
          tenant: { type: "string" },
        },
        ["id", "tenant"],
      ),
      async (input, context) =>
        output(
          await synthesizeResearch(
            context.workspace,
            String(input.id ?? ""),
            String(input.tenant ?? ""),
            context.signal,
          ),
        ),
    );
    tools.register(
      definition("research_status", "Read tenant-scoped research state, sources, and citations", {
        id: { type: "string" },
        tenant: { type: "string" },
      }, ["tenant"]),
      async (input, context) => {
        const records = await readResearch(context.workspace, {
          id: typeof input.id === "string" ? input.id : undefined,
          tenant: String(input.tenant ?? ""),
        });
        const researches = records.slice(0, 20).map(compact);
        return JSON.stringify({ research: researches[0] ?? null, researches });
      },
    );
    prompts.register({
      id: "grounded-research",
      title: "Grounded research and escalation",
      priority: 40,
      content:
        "For research questions, plan a bounded task, collect approved sources, then synthesize only fresh and quality-scored evidence. Every factual answer must include citations from grounded_research. If evidence is stale, conflicting, missing, or below min_confidence, preserve the task and escalate instead of guessing. This service does not perform arbitrary network fetching: use an approved HTTPS connector, MCP capability, or bounded worker to obtain source text before research_add_source. Keep tenant and trace_id consistent and use idempotency keys when retries are possible.",
    });
  },
};
