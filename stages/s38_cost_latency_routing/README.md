# 38: Observability — 质量、延迟与成本在同一 Trace 上

[← s37](../s37_security_governance/README.md) · [课程地图](../README.md) ·
[s39 →](../s39_loop_control_replay/README.md)

> “没有证据，就无法解释 Agent 为什么变贵或变差”
>
> 生产层：可观测性。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

只记录最终成功率无法定位问题来自 Prompt、Provider、Tool、MCP、Memory、A2A 还是 Worker。

## 解决方案

在统一 Trace 上关联输入规模、工具调用、延迟、成本、结果与下游依赖，并计算 SLO 摘要。

## 工作原理

1. 采集版本化 Observation。
2. 计算 successRate、p95 和 cost。
3. 按 Provider/租户/版本切片。
4. 异常触发告警和 Runbook。

### 执行链

```text
trace events → metrics/logs/spans → SLO summary → alert/AIOps
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s38`
- 类型检查：`deno check stages/s38_cost_latency_routing/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

构造多条不同延迟和结果的 Observation，手算并核对 p95、成功率和总成本。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产需要 OTLP、采样、PII Redaction、下游健康度、成本异常检测和对版本/租户的安全关联。

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

进入 [s39 →](../s39_loop_control_replay/README.md)，继续补齐生产 Agent 的下一层约束。
