# s41：MCP Server、Resources、Prompts 与 Transport

## 本课目标

s19/s26 只展示了客户端发现工具和协商能力。书中的 MCP 还要求理解服务端、Tools/Resources/Prompts
三类能力，以及 STDIO、SSE、Streamable HTTP 的生命周期。

## 代码地图

- `TeachingMcpServer`：注册工具、资源和 Prompt，并统一处理 JSON-RPC。
- `dispatch`：实现 `initialize`、`tools/list`、`resources/list`、`prompts/list`、`tools/call`。
- `encodeSse`：把 JSON-RPC 响应转换为 SSE 帧。

## 运行

```sh
deno check stages/s41_mcp_server_transports.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s41_mcp_server_transports.ts
```

## 实验顺序

1. 先 `initialize`，保存协议版本和 capabilities。
2. 只列出需要的 capability，避免工具膨胀。
3. 读取 Resource，再调用 Tool；两者都是不可信输入。
4. 将响应编码为 SSE，观察事件边界和 JSON-RPC ID。

## 练习

- 为资源增加 MIME type、etag 和订阅通知。
- 模拟 STDIO 的逐行读取与进程退出。
- 为工具调用增加 `progress`、取消和超时。

## 与生产的边界

这里是协议模拟器，不会启动真实子进程或 HTTP Server。生产要处理
session、心跳、并发、断线重连、认证和资源权限。
