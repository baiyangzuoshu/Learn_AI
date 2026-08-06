# 02: Tool Use — 加工具不改循环

[← s01](../s01_agent_loop/README.md) · [课程地图](../README.md) ·
[s03 →](../s03_permission/README.md)

> “新增能力，只新增定义与 Handler”
>
> Harness 层：工具注册。本章只增加一个机制，Agent 的核心决策循环保持不变。

## 本章目标

学完后，你应该能解释这个机制解决的具体问题、指出它插入 Agent Loop
的位置，并能修改一个约束后验证行为变化。

## 问题

把每个工具写进 Agent Loop 的条件分支，会让循环越来越难测试，也无法统一校验与授权。

## 解决方案

用 ToolDefinition 描述模型可见契约，用 Handler 承担本地执行，再通过 Registry 按名称分发。

## 工作原理

1. 注册 bash/read/write/edit 定义与处理器。
2. 解析并校验模型参数。
3. 执行前授权、执行后触发 Hook。
4. 把成功或失败结果统一回填。

### 执行链

```text
tool schema → registry lookup → authorize → handler → bounded result
```

模型负责决定下一步，Harness 负责校验、执行、记录和限制。失败也作为观察返回模型，而不是被隐藏。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s02`
- 类型检查：`deno check stages/s02_tool_use/code.ts`

沿着注册点、输入校验、执行函数和 `agentLoop()`
四处阅读。先找到本章新增的状态或工具，再追踪它如何复用前一章。

## 观察清单

比较文件工具与 Bash 的参数边界，特别观察 safePath 和 edit_file 的唯一匹配约束。

建议同时记录：模型看见了什么 Schema、Harness
实际执行了什么、结果如何回到消息历史，以及取消或失败发生在哪一层。

## 边界与生产差距

JSON Schema 只改善模型输出，不能替代运行时校验；生产实现还要统一副作用分类、取消传播和输出 Schema。

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

进入 [s03 →](../s03_permission/README.md)，在同一个 Loop 上继续增加下一项能力。
