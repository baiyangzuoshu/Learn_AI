import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { paginateToolResult, readArchivedToolResult } from "../tool_result_store.ts";

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "read_tool_result",
    description:
      "Read a saved large tool result by reference. Select either a 1-based line range or a character range; use nextStartChar when a page says more remains.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Reference from the archived result preview" },
        start_line: { type: "integer", minimum: 1 },
        line_count: { type: "integer", minimum: 1, maximum: 200 },
        start_char: { type: "integer", minimum: 0 },
        char_count: { type: "integer", minimum: 1, maximum: 20000 },
      },
      required: ["reference"],
    },
  },
};

export const toolResults: HarnessFeature = {
  id: "tool-results",
  capability: {
    id: "core",
    title: "Core",
    description: "Essential workspace and safety tools.",
    alwaysAvailable: true,
  },
  register({ tools }) {
    tools.register(definition, async (input, context) => {
      const reference = String(input.reference ?? "");
      if (input.start_line !== undefined && input.start_char !== undefined) {
        throw new Error("choose either start_line or start_char, not both");
      }
      const content = await readArchivedToolResult(
        context.workspace,
        context.sessionId,
        reference,
      );
      const page = paginateToolResult(content, {
        startLine: typeof input.start_line === "number" ? input.start_line : undefined,
        lineCount: typeof input.line_count === "number" ? input.line_count : undefined,
        startChar: typeof input.start_char === "number" ? input.start_char : undefined,
        charCount: typeof input.char_count === "number" ? input.char_count : undefined,
      });
      return JSON.stringify({
        status: "ok",
        reference,
        ...page,
        ...(page.hasMore && page.nextStartChar !== undefined
          ? { nextPage: { start_char: page.nextStartChar } }
          : page.hasMore && "nextStartLine" in page
          ? { nextPage: { start_line: page.nextStartLine } }
          : {}),
      });
    }, { risk: "read-only", scopes: ["read"], maxOutput: 50_000 });
  },
};
