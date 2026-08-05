# s73：MCP Transport Adapter

## 本课目标

将 MCP 协议状态和传输实现分离，使同一 Client Session 可以运行在 STDIO、SSE 或 Streamable HTTP 上。

## 核心机制

- `LineTransport` 只处理消息发送、接收和关闭。
- `McpTransportSession` 负责请求 ID、初始化和工具调用。
- `AbortSignal` 中断等待中的接收，`close` 负责清理连接。

## 练习

1. 用 `Deno.Command` 的 stdin/stdout 实现真实 STDIO Transport。
2. 加入 `resources/read`、Prompts、通知和 server capability 变化。
3. 测试断线重连、请求超时和过大响应。

## 生产边界

课程使用内存 Transport；上线还需要认证、Session 过期、协议版本兼容和远端 HTTPS 校验。
