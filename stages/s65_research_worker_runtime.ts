import { type AgentEvent, agentLoop as previousAgentLoop } from "./s64_provider_agent_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Source = { url: string; title: string; text: string; fetchedAt: string };
export type ResearchCheckpoint = {
  query: string;
  urls: string[];
  sources: Source[];
  attempts: number;
};
export interface SourceFetcher {
  fetch(url: string, signal: AbortSignal): Promise<Source>;
}
export interface CheckpointStore {
  load(query: string): Promise<ResearchCheckpoint | undefined>;
  save(checkpoint: ResearchCheckpoint): Promise<void>;
}

export class ResearchWorker {
  constructor(
    private readonly fetcher: SourceFetcher,
    private readonly checkpoints: CheckpointStore,
  ) {}
  async run(query: string, urls: string[], signal = new AbortController().signal) {
    const checkpoint = await this.checkpoints.load(query) ??
      { query, urls, sources: [], attempts: 0 };
    const known = new Set(checkpoint.sources.map((source) => source.url));
    for (const url of urls.slice(0, 8)) {
      if (known.has(url)) continue;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        checkpoint.attempts++;
        try {
          const source = await this.fetcher.fetch(url, signal);
          checkpoint.sources.push({ ...source, text: source.text.slice(0, 20_000) });
          await this.checkpoints.save(checkpoint);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        }
      }
      if (lastError) checkpoint.urls.push(`failed:${url}`);
    }
    const evidence = checkpoint.sources.map((source) =>
      `[${source.title}](${source.url}): ${source.text}`
    ).join("\n");
    const answer = evidence ? `Research for ${query}\n${evidence}` : "No verified sources";
    return { ...checkpoint, answer, quality: checkpoint.sources.length / Math.max(1, urls.length) };
  }
}

class LessonFetcher implements SourceFetcher {
  async fetch(url: string) {
    return {
      url,
      title: "lesson source",
      text: `verified evidence from ${url}`,
      fetchedAt: new Date().toISOString(),
    };
  }
}
class LessonCheckpoints implements CheckpointStore {
  private value?: ResearchCheckpoint;
  async load() {
    return this.value;
  }
  async save(value: ResearchCheckpoint) {
    this.value = structuredClone(value);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "research_worker_runtime",
    description: "Fetch bounded sources with retries, checkpoints, citations, and a quality score",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      await new ResearchWorker(new LessonFetcher(), new LessonCheckpoints()).run(
        String(input.query),
        ["https://source.test/a", "https://source.test/b"],
      ),
    ),
);
registerSystemPromptSection({
  id: "s65-research-worker",
  title: "Resumable research worker",
  priority: 46,
  content:
    "Research is a durable worker: fetch in parallel-friendly bounded steps, retry transient failures, checkpoint every source, cite evidence, and expose quality instead of pretending certainty.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s65 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
