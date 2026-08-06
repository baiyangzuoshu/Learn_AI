# 34: Release AIOps — Canary 与 Rollback 同属门禁

[← s33](../s33_flow_handoff_guardrails/README.md) · [课程地图](../README.md) ·
[s35 →](../s35_evaluation_feedback/README.md)

> “构建成功只是发布链的开始”
>
> 生产层：发布。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

Prompt、工具、模型和 Schema 独立变化时，只标一个应用版本无法复现行为，也无法安全回滚。

## 解决方案

用 Release Manifest 绑定所有行为版本，按 Eval、安全和 SLO 决定 canary、冻结或 rollback。

## 工作原理

1. 校验 Manifest 和 provenance。
2. 通过离线 Gate。
3. 小流量 Canary 观察真实指标。
4. 失败时保留 Trace 并回滚健康版本。

### 执行链

```text
manifest → eval/security gate → canary → promote / freeze + rollback
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s34`
- 类型检查：`deno check stages/s34_hybrid_rag/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

依次降低 success、提高 p95、cost 和 error，观察每个 SLO 产生的拒绝原因。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产控制器需要签名、真实指标平台、告警渠道、Incident Runbook、跨版本回放和值班流程。

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

进入 [s35 →](../s35_evaluation_feedback/README.md)，继续补齐生产 Agent 的下一层约束。
