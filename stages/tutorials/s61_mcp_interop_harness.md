# s61：MCP 互操作 Harness

## 本课目标

把 s51 的 JSON-RPC 处理器提升为可替换的 MCP Client/Server
契约：客户端负责初始化、能力发现、调用、取消和输出预算，传输层只负责传递消息。

## 关键机制

- `McpInteropClient`：初始化前不能调用工具，并为每次请求生成关联 ID。
- `createInteropServer`：独立于传输的协议服务端，可替换为真实 STDIO、SSE 或 Streamable HTTP。
- `maxBytes` 与 `AbortSignal`：协议正确之外还要限制输出和及时取消。

## 运行与练习

```sh
deno check stages/s61_mcp_interop_harness.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s61_mcp_interop_harness.ts
```

1. 增加 `resources/read` 和 `notifications/tools/list_changed`。
2. 用 `Deno.Command` 启动一个真实子进程，把 stdin/stdout 接到 `McpInteropClient`。
3. 注入超大响应、断开连接和取消信号，验证客户端不会继续消费。

## 生产边界

本课的 server 仍在进程内；生产实现需要真实传输、认证、会话回收、资源订阅和协议兼容测试。
