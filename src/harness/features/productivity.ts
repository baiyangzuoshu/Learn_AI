import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../../core/types.ts";
import { appDataDir } from "../../config/paths.ts";

const def = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
async function key(workspace: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}
async function readOptional(path: string) {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return "";
    throw error;
  }
}
async function writeData(path: string, content: string) {
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const temp = `${path}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temp, content);
  await Deno.rename(temp, path);
}

export const productivity: HarnessFeature = {
  id: "productivity",
  register({ tools, prompts }) {
    tools.register(
      def("todo_write", "Update the temporary checklist", { todos: { type: "array" } }, ["todos"]),
      async (input) => {
        if (!Array.isArray(input.todos)) throw new Error("todos must be an array");
        return `Updated ${input.todos.length} tasks (${
          input.todos.filter((item) => item?.status === "completed").length
        } completed)`;
      },
    );
    tools.register(
      def("memory_read", "Read durable project memory", {}),
      async (_input, context) =>
        await readOptional(`${appDataDir()}/memory/${await key(context.workspace)}.md`) ||
        "(project memory is empty)",
    );
    tools.register(
      def("memory_append", "Append a durable project fact", { content: { type: "string" } }, [
        "content",
      ]),
      async (input, context) => {
        const path = `${appDataDir()}/memory/${await key(context.workspace)}.md`,
          current = await readOptional(path),
          addition = String(input.content ?? "").trim();
        if (!addition || addition.length > 4_000) throw new Error("memory content is invalid");
        await writeData(
          path,
          `${current.trim()}${current.trim() ? "\n" : ""}- ${
            new Date().toISOString().slice(0, 10)
          }: ${addition}\n`,
        );
        return "Project memory updated";
      },
    );
    tools.register(
      def("memory_replace", "Replace project memory with a concise version", {
        content: { type: "string" },
      }, ["content"]),
      async (input, context) => {
        const content = String(input.content ?? "").trim();
        if (content.length > 16_000) throw new Error("memory exceeds 16000 characters");
        await writeData(
          `${appDataDir()}/memory/${await key(context.workspace)}.md`,
          `${content}\n`,
        );
        return "Project memory replaced";
      },
    );
    tools.register(
      def("task_graph_read", "Read the persistent task graph", {}),
      async (_input, context) =>
        await readOptional(`${appDataDir()}/task-graphs/${await key(context.workspace)}.json`) ||
        JSON.stringify({ version: 1, nodes: [] }),
    );
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
    tools.register(
      def("list_skills", "List workspace skills without loading them", {}),
      async (_input, context) => {
        const names: string[] = [];
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            for await (const entry of Deno.readDir(`${context.workspace}/${root}`)) {
              if (entry.isDirectory) {
                try {
                  if (
                    (await Deno.stat(`${context.workspace}/${root}/${entry.name}/SKILL.md`)).isFile
                  ) names.push(entry.name);
                } catch { /* missing */ }
              }
            }
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
        }
        return [...new Set(names)].sort().join("\n") || "(no workspace skills found)";
      },
    );
    tools.register(
      def("load_skill", "Load one workspace SKILL.md", { name: { type: "string" } }, ["name"]),
      async (input, context) => {
        const name = String(input.name ?? "");
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("invalid skill name");
        for (const root of ["skills", ".agents/skills", ".codex/skills"]) {
          try {
            return (await Deno.readTextFile(`${context.workspace}/${root}/${name}/SKILL.md`)).slice(
              0,
              50_000,
            );
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
        }
        throw new Error(`skill not found: ${name}`);
      },
    );
    prompts.register({
      id: "productivity",
      title: "Planning and durable state",
      priority: 20,
      content:
        "Use todo_write for temporary multi-step plans, task_graph tools for durable dependency-aware projects, skills only on demand, and memory only for stable non-secret facts.",
    });
  },
};
