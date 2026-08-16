import { type McpServerConfig, McpSessionManager, type McpTransport } from "../src/mcp.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}

class FakeTransport implements McpTransport {
  readonly methods: string[] = [];
  closed = false;
  lastSignal?: AbortSignal;

  async request(message: { id: string; method: string }, signal?: AbortSignal): Promise<unknown> {
    this.methods.push(message.method);
    this.lastSignal = signal;
    if (message.method === "initialize") {
      return { protocolVersion: "2025-03-26", capabilities: { tools: {} } };
    }
    return { method: message.method, ok: true };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

const config: McpServerConfig = {
  name: "local-tools",
  transport: "http",
  url: "http://127.0.0.1:3000/mcp",
};

Deno.test("MCP manager initializes once and reuses a negotiated session", async () => {
  let created = 0;
  let transport: FakeTransport | undefined;
  const manager = new McpSessionManager(async () => {
    created += 1;
    transport = new FakeTransport();
    return transport;
  });
  const controller = new AbortController();
  await manager.call("/workspace", config, "tools/list", {}, controller.signal);
  await manager.call("/workspace", config, "tools/call", { name: "echo" }, controller.signal);

  assertEquals(created, 1);
  assertEquals(transport?.methods.join(","), "initialize,tools/list,tools/call");
  assertEquals(transport?.lastSignal, controller.signal);
  assertEquals(manager.status("/workspace")[0].initialized, true);
  assertEquals(manager.status("/workspace")[0].transport, "http");
  await manager.shutdown();
  assertEquals(transport?.closed, true);
});

Deno.test("MCP manager replaces changed configuration and closes old transport", async () => {
  const transports: FakeTransport[] = [];
  const manager = new McpSessionManager(async () => {
    const transport = new FakeTransport();
    transports.push(transport);
    return transport;
  });
  await manager.call("/workspace", config, "tools/list", {});
  await manager.call(
    "/workspace",
    { ...config, url: "http://127.0.0.1:3001/mcp" },
    "tools/list",
    {},
  );

  assertEquals(transports.length, 2);
  assertEquals(transports[0].closed, true);
  assertEquals(transports[1].closed, false);
  await manager.shutdown();
  assertEquals(transports[1].closed, true);
});
