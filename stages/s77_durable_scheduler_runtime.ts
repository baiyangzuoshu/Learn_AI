import { type AgentEvent, agentLoop as previousAgentLoop } from "./s76_eval_otel_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ScheduledJob = {
  id: string;
  dueAt: number;
  payload: string;
  attempts: number;
  state: "queued" | "leased" | "done" | "dead";
  leaseUntil?: number;
  error?: string;
};
export interface ScheduleStore {
  load(): Promise<ScheduledJob[]>;
  save(jobs: ScheduledJob[]): Promise<void>;
}
class LessonScheduleStore implements ScheduleStore {
  private jobs: ScheduledJob[] = [];
  async load() {
    return structuredClone(this.jobs);
  }
  async save(jobs: ScheduledJob[]) {
    this.jobs = structuredClone(jobs);
  }
}

export class DurableScheduler {
  private jobs: ScheduledJob[] = [];
  private ready: Promise<void>;
  constructor(private readonly store: ScheduleStore) {
    this.ready = store.load().then((jobs) => {
      this.jobs = jobs;
    });
  }
  async schedule(
    payload: string,
    dueAt = Date.now(),
    id = `schedule-${crypto.randomUUID().slice(0, 8)}`,
  ) {
    await this.ready;
    if (!this.jobs.some((job) => job.id === id)) {
      this.jobs.push({ id, dueAt, payload: payload.slice(0, 8_000), attempts: 0, state: "queued" });
    }
    await this.store.save(this.jobs);
    return id;
  }
  async lease(now = Date.now(), ttlMs = 10_000) {
    await this.ready;
    const job = this.jobs.find((item) =>
      (item.state === "queued" && item.dueAt <= now) ||
      (item.state === "leased" && (item.leaseUntil ?? 0) <= now)
    );
    if (!job) return;
    job.state = "leased";
    job.leaseUntil = now + ttlMs;
    job.attempts++;
    await this.store.save(this.jobs);
    return structuredClone(job);
  }
  async complete(id: string) {
    await this.ready;
    const job = this.jobs.find((item) => item.id === id);
    if (job) job.state = "done";
    await this.store.save(this.jobs);
  }
  async fail(id: string, error: string, maxAttempts = 3) {
    await this.ready;
    const job = this.jobs.find((item) => item.id === id);
    if (job) {
      job.error = error;
      job.state = job.attempts >= maxAttempts ? "dead" : "queued";
    }
    await this.store.save(this.jobs);
  }
  async list() {
    await this.ready;
    return structuredClone(this.jobs);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "durable_scheduler_runtime",
    description:
      "Persist scheduled jobs, lease due work, retry failures, and move poison jobs to dead-letter state",
    parameters: {
      type: "object",
      properties: { payload: { type: "string" } },
      required: ["payload"],
    },
  },
};
registerTool(definition, async (input) => {
  const scheduler = new DurableScheduler(new LessonScheduleStore());
  const id = await scheduler.schedule(String(input.payload));
  const job = await scheduler.lease();
  if (job) await scheduler.complete(job.id);
  return JSON.stringify({ id, jobs: await scheduler.list() });
});
registerSystemPromptSection({
  id: "s77-durable-scheduler",
  title: "Durable scheduler and worker lease",
  priority: 58,
  content:
    "Scheduled work must survive process restart. Persist jobs atomically, lease due work, reclaim expired leases, retry transient failures, and dead-letter poison jobs.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s77 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
