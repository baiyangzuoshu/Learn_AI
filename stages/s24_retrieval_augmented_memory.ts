import { type AgentEvent, agentLoop } from "./s23_evaluation_feedback.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

interface Chunk {
  id: string;
  source: string;
  text: string;
  terms: Set<string>;
}
const indexes = new Map<string, Chunk[]>();
const terms = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []);
const overlap = (left: Set<string>, right: Set<string>) =>
  [...left].reduce((score, term) => score + (right.has(term) ? 1 : 0), 0);

const indexDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "rag_index_documents",
    description: "Build a bounded in-memory lexical retrieval index for teaching RAG",
    parameters: {
      type: "object",
      properties: { documents: { type: "array" } },
      required: ["documents"],
    },
  },
};
const searchDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "rag_search",
    description: "Retrieve relevant indexed chunks with source metadata",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
};
registerTool(indexDefinition, async (input, workspace) => {
  if (!Array.isArray(input.documents) || input.documents.length > 200) {
    throw new Error("documents must contain at most 200 items");
  }
  const chunks: Chunk[] = [];
  for (const [index, raw] of input.documents.entries()) {
    const item = raw as Record<string, unknown>;
    const source = String(item.source ?? `document-${index + 1}`);
    const text = String(item.text ?? "").trim();
    if (!text || text.length > 100_000) throw new Error(`documents[${index}] is invalid`);
    for (let start = 0, part = 0; start < text.length; start += 1_600, part++) {
      const value = text.slice(start, start + 2_000);
      chunks.push({ id: `${source}#${part}`, source, text: value, terms: terms(value) });
      if (chunks.length > 1_000) throw new Error("index exceeds 1000 chunks");
    }
  }
  indexes.set(workspace, chunks);
  return JSON.stringify({ documents: input.documents.length, chunks: chunks.length });
});
registerTool(searchDefinition, async (input, workspace) => {
  const query = String(input.query ?? "").trim();
  const limit = Math.min(20, Math.max(1, Math.floor(Number(input.limit ?? 5))));
  if (!query) throw new Error("query is required");
  const queryTerms = terms(query);
  const results = (indexes.get(workspace) ?? []).map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    text: chunk.text,
    score: overlap(queryTerms, chunk.terms),
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return JSON.stringify({ query, retrieval: "lexical-baseline", results });
});
registerSystemPromptSection({
  id: "s24-retrieval-augmented-memory",
  title: "Retrieval augmented memory",
  priority: 5,
  content:
    "Index bounded source chunks, retrieve only relevant evidence, retain source identifiers, and distinguish retrieved evidence from model knowledge. This stage uses lexical retrieval as a baseline before embeddings and reranking.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s24 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
