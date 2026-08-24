import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import {
  completeHandoff,
  failHandoff,
  readHandoffs,
  submitHandoff,
  transferHandoff,
} from "../handoff.ts";
import type { HandoffRecord } from "../handoff.ts";

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

function compact(record: HandoffRecord): HandoffRecord {
  return {
    ...record,
    artifacts: record.artifacts.slice(-8).map((artifact) => artifact.slice(0, 500)),
    evidence: record.evidence.slice(-8).map((item) => ({
      ...item,
      summary: item.summary.slice(0, 500),
    })),
    idempotencyKeys: [],
  };
}

function output(record: HandoffRecord | null, records: HandoffRecord[] = []): string {
  return JSON.stringify({
    handoff: record ? compact(record) : null,
    handoffs: records.slice(0, 20).map(compact),
  });
}

export const handoff: HarnessFeature = {
  id: "handoff",
  register({ tools, prompts }) {
    tools.register(
      definition("handoff_submit", "Submit a tenant-scoped, trace-linked A2A handoff", {
        tenant: { type: "string" },
        role: { type: "string" },
        objective: { type: "string" },
        trace_id: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["tenant", "role", "objective"]),
      async (input, context) =>
        output(
          await submitHandoff(
            context.workspace,
            {
              tenant: String(input.tenant ?? ""),
              role: String(input.role ?? ""),
              objective: String(input.objective ?? ""),
              traceId: typeof input.trace_id === "string" ? input.trace_id : undefined,
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
      definition("agent_handoff", "Transfer bounded artifact and evidence to an A2A receiver", {
        id: { type: "string" },
        tenant: { type: "string" },
        artifact: { type: "string" },
        evidence: { type: "string" },
        checkpoint: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["id", "tenant", "artifact", "evidence", "checkpoint"]),
      async (input, context) =>
        output(
          await transferHandoff(
            context.workspace,
            String(input.id ?? ""),
            String(input.tenant ?? ""),
            String(input.artifact ?? ""),
            String(input.evidence ?? ""),
            String(input.checkpoint ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
            context.signal,
          ),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition("handoff_complete", "Complete an A2A handoff only when evidence exists", {
        id: { type: "string" },
        tenant: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["id", "tenant"]),
      async (input, context) =>
        output(
          await completeHandoff(
            context.workspace,
            String(input.id ?? ""),
            String(input.tenant ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
            context.signal,
          ),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition("handoff_fail", "Mark an A2A handoff failed with durable evidence", {
        id: { type: "string" },
        tenant: { type: "string" },
        reason: { type: "string" },
        idempotency_key: { type: "string" },
      }, ["id", "tenant", "reason"]),
      async (input, context) =>
        output(
          await failHandoff(
            context.workspace,
            String(input.id ?? ""),
            String(input.tenant ?? ""),
            String(input.reason ?? ""),
            typeof input.idempotency_key === "string" ? input.idempotency_key : undefined,
            context.signal,
          ),
        ),
      { risk: "mutating", scopes: ["mutating"], maxOutput: 50_000 },
    );
    tools.register(
      definition("handoff_status", "Read tenant-scoped A2A handoff state and evidence", {
        id: { type: "string" },
        tenant: { type: "string" },
      }, ["tenant"]),
      async (input, context) => {
        const records = await readHandoffs(context.workspace, {
          id: typeof input.id === "string" ? input.id : undefined,
          tenant: String(input.tenant ?? ""),
        });
        return output(records.at(0) ?? null, records);
      },
    );
    prompts.register({
      id: "a2a-handoff",
      title: "A2A handoff guardrails",
      priority: 38,
      content:
        "A2A handoffs must carry a tenant, receiver role, objective, trace_id, bounded artifact, and evidence checkpoint. Submit with an idempotency key when retries are possible, transfer evidence before completion, and never complete a handoff without durable evidence. Tenant mismatch, terminal-state mutation, oversized artifacts, cancellation, and missing evidence must be rejected.",
    });
  },
};
