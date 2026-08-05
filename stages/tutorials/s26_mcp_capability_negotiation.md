# s26：MCP Protocol and Process Management

## 合并范围

整合 MCP 插件、能力协商、Server/Transport、STDIO、HTTP/SSE、互操作和进程管理。

## 学习重点

MCP 是初始化过的 Session。Manager 负责建立、复用、取消和关闭；Transport 可以是 HTTP、SSE 或
STDIO，协议状态不能和传输耦合。

## 练习

1. 增加 tools/resources/prompts 发现与订阅。
2. 用 `Deno.Command` 接入真实 STDIO，并限制 stderr/output。
3. 测试断线、超时、Session 过期和 HTTPS 策略。

## 生产迁移

作为独立 Feature 接入 ToolRegistry，并保证取消时关闭全部子进程与会话。
