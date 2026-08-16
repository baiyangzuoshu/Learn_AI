import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

export type McpTransportKind = "http" | "sse" | "stdio";

export interface McpServerConfig {
  name: string;
  enabled?: boolean;
  transport?: McpTransportKind;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpTransport {
  request(message: McpRequest, signal?: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpSessionStatus {
  key: string;
  server: string;
  transport: McpTransportKind;
  initialized: boolean;
  capabilities: unknown;
}

const PROTOCOL_VERSION = "2025-03-26";
const MAX_MCP_RESPONSE_BYTES = 2_000_000;
const MAX_STDERR_BYTES = 8_000;

function assertSafeUrl(value: string): URL {
  const parsed = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("MCP requires HTTPS or local HTTP");
  }
  return parsed;
}

function parseJsonRpcResponse(response: Response, text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > MAX_MCP_RESPONSE_BYTES) {
    throw new Error("MCP response exceeds the 2 MB limit");
  }
  const isSse = response.headers.get("content-type")?.includes("text/event-stream");
  const json = isSse
    ? text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) =>
      line.slice(5).trim()
    )
      .filter(Boolean).at(-1)
    : text;
  const payload = JSON.parse(json || "{}") as { error?: { message?: string }; result?: unknown };
  if (payload.error) throw new Error(payload.error.message || "MCP request failed");
  return payload.result;
}

export class HttpMcpTransport implements McpTransport {
  constructor(private readonly url: string) {
    assertSafeUrl(url);
  }

  async request(message: McpRequest, signal?: AbortSignal): Promise<unknown> {
    const parsed = assertSafeUrl(this.url);
    const response = await fetch(parsed, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...message }),
      signal,
    });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    return parseJsonRpcResponse(response, await response.text());
  }

  async close(): Promise<void> {}
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

export class StdioMcpTransport implements McpTransport {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, PendingRequest>();
  private buffer = Buffer.alloc(0);
  private closed = false;
  private stderr = "";

  constructor(command: string, args: string[] = [], env: Record<string, string> = {}) {
    if (!command.trim()) throw new Error("MCP STDIO command is required");
    this.child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.consume(chunk));
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-MAX_STDERR_BYTES);
    });
    this.child.once("error", (error) => this.failPending(error));
    this.child.once("close", (code, signal) => {
      this.closed = true;
      this.failPending(new Error(`MCP STDIO closed (${code ?? signal ?? "unknown"})`));
    });
  }

  request(message: McpRequest, signal?: AbortSignal): Promise<unknown> {
    if (this.closed || !this.child.stdin.writable) {
      return Promise.reject(new Error("MCP STDIO transport is closed"));
    }
    if (signal?.aborted) {
      return Promise.reject(new DOMException("MCP request cancelled", "AbortError"));
    }
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...message }), "utf8");
    const frame = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, "utf8");
    return new Promise((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject, signal };
      const onAbort = () => {
        this.pending.delete(message.id);
        reject(new DOMException("MCP request cancelled", "AbortError"));
      };
      pending.onAbort = onAbort;
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(message.id, pending);
      this.child.stdin.write(Buffer.concat([frame, body]), (error) => {
        if (!error) return;
        this.pending.delete(message.id);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.failPending(new Error("MCP STDIO transport closed"));
    this.child.kill();
  }

  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("utf8");
      const length = Number(header.match(/content-length:\s*(\d+)/i)?.[1]);
      if (!Number.isInteger(length) || length < 0 || length > MAX_MCP_RESPONSE_BYTES) {
        this.failPending(new Error("Invalid MCP STDIO Content-Length"));
        return;
      }
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + length);
      try {
        const payload = JSON.parse(body) as {
          id?: string;
          error?: { message?: string };
          result?: unknown;
        };
        if (!payload.id) continue;
        const pending = this.pending.get(payload.id);
        if (!pending) continue;
        this.pending.delete(payload.id);
        pending.signal?.removeEventListener("abort", pending.onAbort!);
        if (payload.error) pending.reject(new Error(payload.error.message || "MCP request failed"));
        else pending.resolve(payload.result);
      } catch (error) {
        this.failPending(error);
        return;
      }
    }
  }

  private failPending(error: unknown): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.signal?.removeEventListener("abort", pending.onAbort!);
      pending.reject(this.stderr ? new Error(`${String(error)}: ${this.stderr}`) : error);
    }
  }
}

export type McpTransportFactory = (config: McpServerConfig) => Promise<McpTransport>;

async function createTransport(config: McpServerConfig): Promise<McpTransport> {
  const kind = config.transport ?? (config.command ? "stdio" : "http");
  if (kind === "stdio") return new StdioMcpTransport(config.command ?? "", config.args, config.env);
  if (!config.url) throw new Error("MCP server url is required");
  return new HttpMcpTransport(config.url);
}

type ManagedSession = {
  key: string;
  configFingerprint: string;
  transport: McpTransport;
  status: McpSessionStatus;
};

function fingerprint(config: McpServerConfig): string {
  return JSON.stringify({
    name: config.name,
    transport: config.transport,
    url: config.url,
    command: config.command,
    args: config.args,
    env: config.env,
  });
}

export class McpSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly initializing = new Map<string, Promise<ManagedSession>>();

  constructor(private readonly factory: McpTransportFactory = createTransport) {}

  async call(
    workspace: string,
    config: McpServerConfig,
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const key = `${workspace}\u0000${config.name}`;
    const currentFingerprint = fingerprint(config);
    let session = this.sessions.get(key);
    if (session && session.configFingerprint !== currentFingerprint) {
      await session.transport.close();
      this.sessions.delete(key);
      session = undefined;
    }
    if (!session) {
      let pending = this.initializing.get(key);
      if (!pending) {
        pending = this.createSession(key, config, currentFingerprint, signal);
        this.initializing.set(key, pending);
        void pending.then(
          () => this.initializing.delete(key),
          () => this.initializing.delete(key),
        );
      }
      session = await pending;
    }
    return await session.transport.request({ id: crypto.randomUUID(), method, params }, signal);
  }

  private async createSession(
    key: string,
    config: McpServerConfig,
    configFingerprint: string,
    signal?: AbortSignal,
  ): Promise<ManagedSession> {
    const transport = await this.factory(config);
    const status: McpSessionStatus = {
      key,
      server: config.name,
      transport: config.transport ?? (config.command ? "stdio" : "http"),
      initialized: false,
      capabilities: undefined,
    };
    const session = { key, configFingerprint, transport, status };
    try {
      status.capabilities = await transport.request({
        id: crypto.randomUUID(),
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "AI Agent", version: "1.0" },
        },
      }, signal);
      status.initialized = true;
      this.sessions.set(key, session);
      return session;
    } catch (error) {
      await transport.close();
      throw error;
    }
  }

  status(workspace: string, server?: string): McpSessionStatus[] {
    return [...this.sessions.values()]
      .filter((session) =>
        session.key.startsWith(`${workspace}\u0000`) &&
        (!server || session.status.server === server)
      )
      .map((session) => ({ ...session.status }));
  }

  async shutdown(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.transport.close()));
  }
}

export const mcpSessionManager = new McpSessionManager();

export async function shutdownMcpSessions(): Promise<void> {
  await mcpSessionManager.shutdown();
}
