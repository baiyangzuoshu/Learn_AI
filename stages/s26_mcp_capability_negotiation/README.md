# 26: MCP Management — Session 与 Transport 分离

[← s25](../s25_planner_executor_verifier/README.md) · [课程地图](../README.md) ·
[s27 →](../s27_handoff_guardrails/README.md)

> “MCP 是协商后的会话，不是一个 URL”
>
> 生产层：协议管理。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

把每次 MCP 调用都当作独立 HTTP 请求，会丢失初始化状态、能力协商和关闭语义。

## 解决方案

让 McpManager 建立、复用和关闭 Session，Transport 只负责 HTTP、SSE 或 STDIO 的消息传输。

## 工作原理

1. 首次调用先 initialize。
2. 缓存 Server Session。
3. 每次请求传播 AbortSignal。
4. shutdown 关闭全部会话和子进程。

### 执行链

```text
server config → initialize → negotiated session → calls → shutdown
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s26`
- 类型检查：`deno check stages/s26_mcp_capability_negotiation/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

连续调用同一 Server，确认只初始化一次；随后取消请求并验证 Session 能被清理。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产还需 tools/resources/prompts 发现、列表刷新、认证、超时、重连、STDIO stderr 限制和 HTTPS 策略。

生产迁移必须通过 `AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和独立 `HarnessFeature`
完成；禁止从 `src/` 或 `desktop/` 直接导入课程代码。

## 动手练习

1. 修改一个阈值或状态转移，写下预期结果并运行本章验证。
2. 增加一个负例，确认失败会留下可定位证据，而不是被吞掉或误报成功。
3. 把本章机制映射到生产模块，列出契约、持久化、权限、Trace、取消和回滚要求。

## 过关标准

- 能画出执行链并解释每个边界由谁强制。
- 能指出示例中的占位实现和至少三项生产缺口。
- 能给出一条可自动化的验收证据，而不是“人工看起来没问题”。

## 下一章

进入 [s27 →](../s27_handoff_guardrails/README.md)，继续补齐生产 Agent 的下一层约束。
