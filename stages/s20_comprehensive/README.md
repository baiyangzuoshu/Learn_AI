# 20: Comprehensive Harness — 机制很多，循环一个

[← s19](../s19_mcp_plugins/README.md) · [课程地图](../README.md) ·
[继续 s21 →](../s21_bounded_runtime/README.md)

> “选择最小充分能力，所有机制回到一个循环”
>
> Harness 层：综合。本章只增加一个机制，Agent 的核心决策循环保持不变。

## 本章目标

学完后，你应该能解释这个机制解决的具体问题、指出它插入 Agent Loop
的位置，并能修改一个约束后验证行为变化。

## 问题

逐章机制若各自演化成一套 Loop，会产生不同的权限、取消、事件和错误语义。

## 解决方案

用能力清单和自检展示组合状态，所有工具、Prompt、持久化与编排仍围绕唯一 Agent Loop。

## 工作原理

1. Registry 汇总工具与 Prompt。
2. 权限和 Hook 统一包围执行面。
3. 上下文、记忆与任务在调用前组装。
4. 团队、Worktree、MCP 只扩展能力。

### 执行链

```text
input → assemble context/capabilities → one loop → tools/features → verified answer
```

模型负责决定下一步，Harness 负责校验、执行、记录和限制。失败也作为观察返回模型，而不是被隐藏。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s20`
- 类型检查：`deno check stages/s20_comprehensive/code.ts`

沿着注册点、输入校验、执行函数和 `agentLoop()`
四处阅读。先找到本章新增的状态或工具，再追踪它如何复用前一章。

## 观察清单

运行 harness_status 与 harness_self_check，区分 registered、configured 和 healthy。

建议同时记录：模型看见了什么 Schema、Harness
实际执行了什么、结果如何回到消息历史，以及取消或失败发生在哪一层。

## 边界与生产差距

教学综合层不等于生产入口；生产必须通过 AgentRuntime、ToolRegistry、PromptRegistry 和 HarnessFeature
重新设计。

课程代码为了突出机制会使用简化存储、协议或策略。不要把它直接导入 `src/`；迁移时应围绕生产
Registry、Runtime 和 Feature 契约重新实现。

## 动手练习

1. 修改一个预算、状态或校验条件，预测行为后再运行验证。
2. 构造一个失败输入，确认错误有界、可观察，且不会破坏已完成状态。
3. 写出该机制迁移到生产 `HarnessFeature` 时需要的输入、事件、权限类别和取消路径。

## 过关标准

- 能不看代码画出上面的执行链。
- 能运行本章并解释一次关键事件或工具结果。
- 能说清教学简化与生产边界，而不是只描述“功能能用”。

## 下一章

进入 s21，开始把教学机制收紧为可执行的生产预算与验收约束。
