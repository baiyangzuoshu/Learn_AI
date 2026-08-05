import { type AgentEvent, agentLoop as previousAgentLoop } from "./s33_flow_handoff_guardrails.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Document = { id: string; text: string; embedding?: number[]; source?: string };

function terms(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
}

export function lexicalScore(query: string, document: string): number {
  const wanted = new Set(terms(query));
  const found = terms(document);
  return found.length ? found.filter((term) => wanted.has(term)).length / found.length : 0;
}

export function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || !left.length) return 0;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const norm = (values: number[]) =>
    Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return dot / (norm(left) * norm(right) || 1);
}

export function hybridSearch(
  query: string,
  documents: Document[],
  queryEmbedding?: number[],
  limit = 3,
) {
  return documents.map((document) => {
    const lexical = lexicalScore(query, document.text);
    const semantic = queryEmbedding && document.embedding
      ? cosine(queryEmbedding, document.embedding)
      : 0;
    return { ...document, score: 0.55 * lexical + 0.45 * semantic, lexical, semantic };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "hybrid_rag_search",
    description: "Search teaching documents with lexical plus optional vector scores",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        documents: { type: "array" },
        limit: { type: "number" },
      },
      required: ["query", "documents"],
    },
  },
};
registerTool(definition, async (input) => {
  const documents = Array.isArray(input.documents) ? input.documents as Document[] : [];
  return JSON.stringify(
    hybridSearch(String(input.query), documents, undefined, Number(input.limit) || 3),
  );
});
registerSystemPromptSection({
  id: "s34-hybrid-rag",
  title: "Hybrid retrieval and grounding",
  priority: 15,
  content:
    "Retrieve a small evidence set using lexical and semantic signals, preserve source IDs, and require the answer to cite retrieved evidence. Retrieval is not permission to invent missing facts.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(hybridSearch("permission boundary", [
    { id: "a", text: "Permission checks happen before a tool executes" },
    { id: "b", text: "A scheduler wakes a conversation" },
  ]));
  const query = prompt("s34 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
