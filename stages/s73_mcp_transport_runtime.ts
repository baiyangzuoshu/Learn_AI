import { type AgentEvent, agentLoop as previousAgentLoop } from "./s72_schema_trace_context.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type RpcMessage = {
  jsonrpc: "2.0";
  id?: string;
  method: string;
  params?: Record<string, unknown>;
};
export type RpcResult = {
  jsonrpc: "2.0";
  id?: string;
  result?: unknown;
  error?: { code: number; message: string };
};
export interface LineTransport {
  send(message: string): Promise<void>;
  receive(signal?: AbortSignal): Promise<string>;
  close(): Promise<void>;
}

export class MemoryLineTransport implements LineTransport {
  private readonly inbound: string[] = [];
  private closed = false;
  constructor(private readonly server: (message: RpcMessage) => Promise<RpcResult>) {}
  private next?: (value: string) => void;
  async send(message: string) {
    if (this.closed) throw new Error("transport closed");
    const result = await this.server(JSON.parse(message) as RpcMessage);
    if (this.next) {
      const resolve = this.next;
      this.next = undefined;
      resolve(JSON.stringify(result));
    } else this.inbound.push(JSON.stringify(result));
  }
  receive(signal?: AbortSignal) {
    if (this.inbound.length) return Promise.resolve(this.inbound.shift()!);
    return new Promise<string>((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
      this.next = resolve;
      signal?.addEventListener("abort", () => {
        this.next = undefined;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }
  async close() {
    this.closed = true;
    this.next = undefined;
  }
}

export class McpTransportSession {
  private sequence = 0;
  private initialized = false;
  constructor(private readonly transport: LineTransport) {}
  async request(method: string, params: Record<string, unknown> = {}, signal?: AbortSignal) {
    const id = `rpc-${++this.sequence}`;
    await this.transport.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    const response = JSON.parse(await this.transport.receive(signal)) as RpcResult;
    if (response.error) throw new Error(response.error.message);
    return response.result;
  }
  async initialize(signal?: AbortSignal) {
    const result = await this.request("initialize", { protocolVersion: "2025-03-26" }, signal);
    await this.request("notifications/initialized", {}, signal);
    this.initialized = true;
    return result;
  }
  async call(name: string, args: Record<string, unknown>, signal?: AbortSignal) {
    if (!this.initialized) await this.initialize(signal);
    return await this.request("tools/call", { name, arguments: args }, signal);
  }
  async close() {
    await this.transport.close();
  }
}

function lessonServer(request: RpcMessage): Promise<RpcResult> {
  if (request.method === "initialize") {
    return Promise.resolve({
      jsonrpc: "2.0",
      id: request.id,
      result: { protocolVersion: "2025-03-26", capabilities: { tools: {} } },
    });
  }
  if (request.method === "notifications/initialized") {
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: {} });
  }
  return Promise.resolve({
    jsonrpc: "2.0",
    id: request.id,
    result: { content: [{ type: "text", text: JSON.stringify(request.params?.arguments ?? {}) }] },
  });
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "mcp_transport_runtime",
    description: "Run MCP over a line transport with initialization, cancellation, and clean close",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const session = new McpTransportSession(new MemoryLineTransport(lessonServer));
  const result = await session.call("echo", { text: String(input.text) });
  await session.close();
  return JSON.stringify(result);
});
registerSystemPromptSection({
  id: "s73-mcp-transport",
  title: "MCP transport adapters",
  priority: 54,
  content:
    "Keep MCP protocol state independent from transport. The same session contract must work over child-process STDIO, SSE, or Streamable HTTP and always close cleanly.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s73 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
