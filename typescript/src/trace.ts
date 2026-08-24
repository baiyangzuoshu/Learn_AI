export type TraceStatus = "ok" | "error" | "cancelled";
export type TraceSpanKind = "run" | "provider" | "tool";

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: TraceSpanKind;
  startedAt: number;
  durationMs?: number;
  status?: TraceStatus;
}

export interface TraceSummary {
  traceId: string;
  rootSpanId: string;
  status: TraceStatus;
  durationMs: number;
  spanCount: number;
  providerCalls: number;
  toolCalls: number;
  errorSpans: number;
  cancelledSpans: number;
  /**
   * Safe, parameter-free span metadata for the local desktop trace inspector.
   * Prompts, tool arguments, outputs and credentials are intentionally absent.
   */
  spans: TraceSpan[];
}

export class TraceBook {
  readonly traceId = crypto.randomUUID();
  readonly spans: TraceSpan[] = [];

  start(name: string, kind: TraceSpanKind, parent?: TraceSpan): TraceSpan {
    const span: TraceSpan = {
      traceId: this.traceId,
      spanId: crypto.randomUUID().slice(0, 12),
      parentSpanId: parent?.spanId,
      name,
      kind,
      startedAt: performance.now(),
    };
    this.spans.push(span);
    return span;
  }

  end(span: TraceSpan, status: TraceStatus): TraceSpan {
    if (span.durationMs === undefined) {
      span.durationMs = Math.max(0, Math.round(performance.now() - span.startedAt));
    }
    span.status = status;
    return span;
  }

  summary(root: TraceSpan, status: TraceStatus): TraceSummary {
    this.end(root, status);
    const childSpans = this.spans.filter((span) => span.spanId !== root.spanId);
    const errorSpans = childSpans.filter((span) => span.status === "error").length;
    const cancelledSpans = childSpans.filter((span) => span.status === "cancelled").length;
    return {
      traceId: this.traceId,
      rootSpanId: root.spanId,
      status,
      durationMs: root.durationMs ?? 0,
      spanCount: this.spans.length,
      providerCalls: this.spans.filter((span) => span.kind === "provider").length,
      toolCalls: this.spans.filter((span) => span.kind === "tool").length,
      errorSpans: errorSpans || (status === "error" ? 1 : 0),
      cancelledSpans: cancelledSpans || (status === "cancelled" ? 1 : 0),
      spans: this.spans.map((span) => ({ ...span })),
    };
  }
}
