# 21: Production Runtime — 预算必须可执行

[← s20](../s20_comprehensive/README.md) · [课程地图](../README.md) ·
[s22 →](../s22_structured_tracing/README.md)

> “预算是运行时状态，不是给模型看的愿望”
>
> 生产层：运行时预算。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

主循环、子 Agent 和外部协议若没有统一上限，会在异常或模型停滞时持续消耗时间、工具次数与费用。

## 解决方案

用 RuntimeBudget 对迭代、工具调用、输出和成本逐项记账，并在每个步骤前检查取消。

## 工作原理

1. 创建共享预算账本。
2. 每步消费对应额度。
3. 超限立即产生明确错误。
4. 向嵌套执行分配子预算。

### 执行链

```text
run options → budget ledger → bounded steps → result / budget error
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s21`
- 类型检查：`deno check stages/s21_bounded_runtime/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

降低 toolCalls 或 outputChars 上限，确认超限发生在真实执行路径而不是最终提示文本。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

示例只演示内存计数；生产还需 deadline、Token、并发、Provider/MCP/Agent 子预算和开发者事件。

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

进入 [s22 →](../s22_structured_tracing/README.md)，继续补齐生产 Agent 的下一层约束。

## 课程图

![s21_bounded_runtime 执行链](images/overview.svg)

图中把本章新增机制放在统一 Agent Loop
的边界上；阅读代码时，沿箭头核对输入、执行、限制和证据是否一致。
