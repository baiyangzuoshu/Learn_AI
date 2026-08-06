# 30: Evaluation CI — 用回归证据决定晋级

[← s29](../s29_cognitive_monitor/README.md) · [课程地图](../README.md) ·
[s31 →](../s31_structured_io/README.md)

> “有代码不等于质量通过”
>
> 生产层：评估。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

只靠手工试用无法发现 Prompt、模型、工具或检索变化带来的系统性回归。

## 解决方案

运行版本化 EvalCase，统一输出质量、Grounding、人工复核项与 Gate 结果。

## 工作原理

1. 固定数据集和期望。
2. 执行候选版本。
3. 计算通过率与引用覆盖。
4. 阈值未达标时阻断发布。

### 执行链

```text
dataset → candidate run → scorers/critic → review queue → CI gate
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s30`
- 类型检查：`deno check stages/s30_production_readiness/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

加入一个错误答案和一个缺引用答案，确认 review 列表与 passed 状态准确变化。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产评估还需数据版本、LLM Judge、Rubric、flaky 重跑、延迟成本、安全负例和生产数据脱敏隔离。

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

进入 [s31 →](../s31_structured_io/README.md)，继续补齐生产 Agent 的下一层约束。
