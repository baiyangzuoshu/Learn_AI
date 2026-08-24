import type { ToolCall, ToolDefinition } from "./types.ts";

export interface Tool {
  definition: ToolDefinition;
  execute(argumentsJson: string): Promise<string>;
}

export class ToolRegistry {
  #tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.#tools.set(tool.definition.function.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.#tools.get(name);
  }

  definitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((tool) => tool.definition);
  }
}

function parseArguments(argumentsJson: string): Record<string, unknown> {
  const value: unknown = JSON.parse(argumentsJson);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("tool arguments must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export function createBashTool(workspace: string, maxOutput = 50_000): Tool {
  return {
    definition: {
      type: "function",
      function: {
        name: "bash",
        description: "Run a shell command in the current workspace",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
          additionalProperties: false,
        },
      },
    },
    async execute(argumentsJson: string): Promise<string> {
      const args = parseArguments(argumentsJson);
      if (typeof args.command !== "string" || args.command.length === 0) {
        return "Error: command is required";
      }
      const command = new Deno.Command("/bin/sh", {
        args: ["-c", args.command],
        cwd: workspace,
        stdout: "piped",
        stderr: "piped",
      });
      const result = await command.output();
      const decoder = new TextDecoder();
      const output = decoder.decode(result.stdout) + decoder.decode(result.stderr);
      const bounded = output.slice(0, maxOutput);
      return bounded || `(exit ${result.code})`;
    },
  };
}

export function formatToolEvent(call: ToolCall, result: string): string {
  return `[工具调用] ${call.function.name}\n[工具结果]\n${result}`;
}
