# 36: Provider Routing — 能力、质量、成本和故障共同决策

[← s35](../s35_evaluation_feedback/README.md) · [课程地图](../README.md) ·
[s37 →](../s37_security_governance/README.md)

> “模型是动态路由目标，不是永远固定的配置”
>
> 生产层：Provider 路由。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

单一默认模型可能缺少所需能力、延迟过高或正处于故障，盲目 fallback 还会突破成本预算。

## 解决方案

过滤能力和 Circuit 状态，再综合质量、延迟与成本选择 Provider，并记录降级原因。

## 工作原理

1. 声明 Provider 能力与观测指标。
2. 排除打开 Circuit 的候选。
3. 按任务约束评分。
4. 在共享预算内执行有限 fallback。

### 执行链

```text
task requirements → eligible providers → score → call → circuit/fallback
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s36`
- 类型检查：`deno check stages/s36_deploy_worker_queue/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

让首选 Provider failures 达到阈值，确认路由切换；请求不存在的能力时应明确失败。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产路由要考虑上下文窗口、视觉、函数调用、JSON Schema、租户配额、区域与凭据隔离。

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

进入 [s37 →](../s37_security_governance/README.md)，继续补齐生产 Agent 的下一层约束。
