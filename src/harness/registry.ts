import type { ToolDefinition } from "../core/types.ts";
import type { RegisteredTool, ToolHandler, ToolRegistryContract } from "./contracts.ts";

export class ToolRegistry implements ToolRegistryContract {
  #tools = new Map<string, RegisteredTool>();
  register(definition: ToolDefinition, handler: ToolHandler): void {
    const name = definition.function.name.trim();
    if (!name) throw new Error("Tool name is required");
    if (this.#tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    this.#tools.set(name, { definition, handler });
  }
  get(name: string): RegisteredTool | undefined {
    return this.#tools.get(name);
  }
  definitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((tool) => tool.definition);
  }
  names(): string[] {
    return [...this.#tools.keys()];
  }
}
