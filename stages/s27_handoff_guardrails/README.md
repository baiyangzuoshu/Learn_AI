# 27: A2A Handoff — 交接目标、证据与权限

[← s26](../s26_mcp_capability_negotiation/README.md) · [课程地图](../README.md) ·
[s28 →](../s28_checkpoint_resume/README.md)

> “好的交接不是“帮我看看””
>
> 生产层：多 Agent 交接。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

模糊委派会丢失租户、角色、完成标准和证据，网络重试还可能重复触发副作用。

## 解决方案

通过 AgentGateway 提交 trace-linked、tenant-scoped、idempotent 的任务，并限制 Artifact。

## 工作原理

1. 提交结构化 AgentTask。
2. 用幂等键复用重复请求。
3. Handoff 携带角色与证据。
4. 状态机限制重复完成和超大产物。

### 执行链

```text
caller → gateway → scoped task → artifact/evidence → receiver
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s27`
- 类型检查：`deno check stages/s27_handoff_guardrails/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

用同一个幂等键提交两次，确认返回同一任务；再测试完成后继续 handoff 的拒绝路径。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产 A2A 需要 TLS、身份认证、持久任务仓储、能力版本、事件流、取消和跨进程 Trace。

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

进入 [s28 →](../s28_checkpoint_resume/README.md)，继续补齐生产 Agent 的下一层约束。

## 课程图

![s27_handoff_guardrails 执行链](images/overview.svg)

图中把本章新增机制放在统一 Agent Loop
的边界上；阅读代码时，沿箭头核对输入、执行、限制和证据是否一致。
