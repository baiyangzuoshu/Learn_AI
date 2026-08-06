# 29: Grounded Research — 证据不足就升级

[← s28](../s28_checkpoint_resume/README.md) · [课程地图](../README.md) ·
[s30 →](../s30_production_readiness/README.md)

> “研究结果必须可追溯，也允许说不知道”
>
> 生产层：深度研究。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

搜索结果可能过期、互相矛盾或根本不足；直接综合会把缺口包装成看似确定的答案。

## 解决方案

让 Planner 驱动有界检索 Worker，筛选 freshness，生成引用，并按置信度决定回答或升级。

## 工作原理

1. 拆分研究问题。
2. 并发抓取但限制预算。
3. 评估来源新鲜度与质量。
4. Critic 检查事实引用并计算置信度。

### 执行链

```text
question → plan → bounded retrieval → critic → cited answer / escalation
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s29`
- 类型检查：`deno check stages/s29_cognitive_monitor/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

混入空来源和过期来源，观察 confidence、citations 与 escalate 如何变化。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

真实 Search/Fetcher 还涉及 robots、许可、费用、Checkpoint、冲突处理、引用覆盖率和审计。

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

进入 [s30 →](../s30_production_readiness/README.md)，继续补齐生产 Agent 的下一层约束。
