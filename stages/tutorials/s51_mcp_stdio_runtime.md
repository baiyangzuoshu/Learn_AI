# s51：MCP STDIO 真实会话

## 本课目标

s41 有协议模型，s51 把它推进到逐行 JSON-RPC 会话：初始化、能力协商、通知、取消、工具调用和干净结束。

## 核心符号

- `dispatchMcp`：纯协议分发器。
- `McpContext`：保存 initialized、sessionId 和取消集合。
- `runStdioSession`：把 stdin 行转换为 stdout 行。

## 运行

```sh
deno check stages/s51_mcp_stdio_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s51_mcp_stdio_runtime.ts
```

## 实验

先发送未初始化的 `tools/list`，再发送 `initialize` 和 `notifications/initialized`。观察错误如何保持
JSON-RPC 结构。发送 cancellation 后再次调用同一个 request ID，确认请求被拒绝。

## 练习

1. 使用 `Deno.stdin.read` 实现真实 stdin reader。
2. 为每行设置最大字节数，拒绝超大请求。
3. 为工具调用加入 deadline、progress notification 和子进程清理。

## 与生产的边界

本课没有自动启动子进程；生产要处理信号、退出码、stderr、重启退避、session 过期和权限隔离。
