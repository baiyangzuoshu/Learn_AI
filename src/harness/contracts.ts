import type { Message, ToolDefinition } from "../core/types.ts";

export type PermissionMode = "ask" | "auto" | "full";
export interface ToolContext {
  workspace: string;
  signal?: AbortSignal;
}
export interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResult {
  name: string;
  input: string;
  output: string;
}
export type ToolHandler = (input: Record<string, unknown>, context: ToolContext) => Promise<string>;
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
export interface PromptSection {
  id: string;
  title: string;
  content: string;
  priority: number;
}
export interface HarnessEvent {
  type: "tool" | "hook";
  name: string;
  detail?: string;
  input?: string;
  output?: string;
}
export interface RunOptions {
  query: string;
  model?: string;
  history?: Message[];
  workspace?: string;
  permissionMode?: PermissionMode;
  signal?: AbortSignal;
  onEvent?: (event: HarnessEvent) => void;
}
export interface HarnessFeature {
  id: string;
  register(
    context: {
      tools: ToolRegistryContract;
      prompts: PromptRegistryContract;
      run: (options: RunOptions) => Promise<string>;
    },
  ): void;
}
export interface ToolRegistryContract {
  register(definition: ToolDefinition, handler: ToolHandler): void;
}
export interface PromptRegistryContract {
  register(section: PromptSection): void;
}
