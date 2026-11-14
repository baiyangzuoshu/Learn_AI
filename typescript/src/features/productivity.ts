import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { appDataDir } from "../config/paths.ts";
import { isNotFound, readUtf8, writeTextAtomic } from "../platform.ts";
import { readdir, readFile, stat } from "node:fs/promises";
import {
  legacyMemoryTenant,
  migrateLegacyMemory,
  readMemoryRecords,
  replaceMemory,
  writeMemory,
} from "../memory_service.ts";

const def = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const loadedSkillSessions = new Map<string, Set<string>>();
const SKILL_SESSION_CACHE_LIMIT = 128;

function skillDescription(content: string): string {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const frontmatterDescription = frontmatter?.[1]?.match(/^description:\s*(.+)$/mi)?.[1]
    ?.trim().replace(/^['"]|['"]$/g, "");
  if (frontmatterDescription) return frontmatterDescription.slice(0, 240);
  const heading = content.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  const paragraph = content.split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\r?\n/g, " ").trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("---"));
  return (heading?.replace(/^#\s+/, "") || paragraph || "Workspace skill").slice(0, 240);
}
//
async function key(workspace: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}
//
async function readOptional(path: string) {
  try {
    return await readUtf8(path);
  } catch (error) {
    if (isNotFound(error)) return "";
    throw error;
  }
}
//
async function writeData(path: string, content: string) {
  await writeTextAtomic(path, content);
}
//
export const productivity: HarnessFeature = {
  id: "productivity",
  capability: {
    id: "productivity",
    title: "Planning and memory",
    description: "Todos, task graphs, and durable memory tools.",
  },
  register({ tools, prompts }) {
    //todo_write
    tools.register(
      def("todo_write", "Update the temporary checklist", { todos: { type: "array" } }, ["todos"]),
      async (input) => {
        if (!Array.isArray(input.todos)) throw new Error("todos must be an array");
        return `Updated ${input.todos.length} tasks (${
          input.todos.filter((item) => item?.status === "completed").length
        } completed)`;
      },
    );
    //memory_read (deprecated compatibility alias)
    tools.register(
      def("memory_read", "[Deprecated] Read legacy project memory; use memory_search", {}),
      async (_input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const records = await readMemoryRecords(context.workspace, { tenant: legacyMemoryTenant });
        return records.map((record) => `- ${record.text}`).join("\n") ||
          "(project memory is empty)";
      },
      undefined,
      { deprecated: true },
    );
    //memory_append (deprecated compatibility alias)
    tools.register(
      def("memory_append", "[Deprecated] Append legacy memory; use memory_store", {
        content: { type: "string" },
      }, ["content"]),
      async (input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const record = await writeMemory(context.workspace, {
          tenant: legacyMemoryTenant,
          kind: "semantic",
          text: String(input.content ?? "").trim(),
          source: "deprecated-memory_append",
        }, context.signal);
        return `[Deprecated] Project memory updated via memory_service (${record.id})`;
      },
      undefined,
      { deprecated: true },
    );
    //memory_replace (deprecated compatibility alias)
    tools.register(
      def("memory_replace", "[Deprecated] Replace legacy memory; use memory_store", {
        content: { type: "string" },
      }, ["content"]),
      async (input, context) => {
        await migrateLegacyMemory(context.workspace, context.signal);
        const record = await replaceMemory(context.workspace, {
          tenant: legacyMemoryTenant,
          kind: "semantic",
          text: String(input.content ?? "").trim(),
          source: "deprecated-memory_replace",
        }, context.signal);
        return `[Deprecated] Project memory replaced via memory_service (${record.id})`;
      },
      undefined,
      { deprecated: true },
    );
    //task_graph_read
    tools.register(
      def("task_graph_read", "Read the persistent task graph", {}),
      async (_input, context) =>
        await readOptional(`${appDataDir()}/task-graphs/${await key(context.workspace)}.json`) ||
        JSON.stringify({ version: 1, nodes: [] }),
    );
    //task_graph_write
    tools.register(
      def("task_graph_write", "Replace the persistent task graph", { nodes: { type: "array" } }, [
        "nodes",
      ]),
      async (input, context) => {
        if (!Array.isArray(input.nodes)) throw new Error("nodes must be an array");
        const ids = new Set<string>();
        for (const raw of input.nodes) {
          const node = raw as Record<string, unknown>, id = String(node.id ?? "");
          if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || ids.has(id)) {
            throw new Error(
              "task ids are invalid or duplicated",
            );
          }
          ids.add(id);
        }
        for (const raw of input.nodes) {
          for (
            const dependency of Array.isArray((raw as any).dependsOn) ? (raw as any).dependsOn : []
          ) if (!ids.has(String(dependency))) throw new Error(`missing dependency: ${dependency}`);
        }
        const graph = { version: 1, updatedAt: new Date().toISOString(), nodes: input.nodes };
        await writeData(
          `${appDataDir()}/task-graphs/${await key(context.workspace)}.json`,
          `${JSON.stringify(graph, null, 2)}\n`,
        );
        return `Saved task graph: ${input.nodes.length} nodes`;
      },
    );
    //list_skills
    tools.register(
      def(
        "list_skills",
        "List workspace skill names and short descriptions without loading full instructions",
        {},
      ),
      async (_input, context) => {
        const skills: Array<{ name: string; description: string }> = [];
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            for (
              const entry of await readdir(`${context.workspace}/${root}`, { withFileTypes: true })
            ) {
              if (entry.isDirectory()) {
                try {
                  const path = `${context.workspace}/${root}/${entry.name}/SKILL.md`;
                  if ((await stat(path)).isFile()) {
                    const content = (await readFile(path, "utf8")).slice(0, 8_000);
                    skills.push({ name: entry.name, description: skillDescription(content) });
                  }
                } catch { /* missing */ }
              }
            }
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }
        const unique = new Map(skills.map((skill) => [skill.name, skill]));
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name))
          .map((skill) => `${skill.name} — ${skill.description}`)
          .join("\n") || "(no workspace skills found)";
      },
      undefined,
      { group: "core" },
    );
    //load_skill
    tools.register(
      def(
        "load_skill",
        "Load a workspace skill's full instructions once per session",
        { name: { type: "string" } },
        ["name"],
      ),
      async (input, context) => {
        const name = String(input.name ?? "");
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("invalid skill name");
        const cacheKey = `${context.workspace}\0${context.sessionId}`;
        let loaded = loadedSkillSessions.get(cacheKey);
        if (!loaded) {
          loaded = new Set<string>();
          loadedSkillSessions.set(cacheKey, loaded);
          while (loadedSkillSessions.size > SKILL_SESSION_CACHE_LIMIT) {
            loadedSkillSessions.delete(loadedSkillSessions.keys().next().value!);
          }
        }
        if (loaded.has(name)) {
          return `Skill ${name} is already loaded in this session; reuse the instructions already in context.`;
        }
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            const content = (await readFile(
              `${context.workspace}/${root}/${name}/SKILL.md`,
              "utf8",
            )).slice(0, 50_000);
            loaded.add(name);
            return content;
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }
        throw new Error(`skill not found: ${name}`);
      },
      undefined,
      { group: "core" },
    );
    //
    prompts.register({
      id: "productivity",
      title: "Planning and durable state",
      priority: 20,
      content:
        "Use todo_write for temporary multi-step plans, task_graph tools for durable dependency-aware projects, skills only on demand, and memory_store/memory_search for stable non-secret facts. The legacy memory_read/memory_append/memory_replace aliases are deprecated and exist only during migration.",
    });
  },
};
