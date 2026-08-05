# s21：Production Agent Runtime

## 合并范围

整合原预算、Agent Runtime、Schema/Trace 适配和生产迁移课程。目标是理解：所有能力最终必须经由同一个
Agent Loop 执行。

## 学习重点

`RuntimeBudget` 将迭代、工具、输出和成本变成硬限制。`runBounded` 在每一步检查取消信号；任何 Feature
都只能带着 workspace、trace 和预算进入 Runtime，不能自建循环。

## 练习

1. 加入 deadline、token 和并发预算。
2. 让超限生成开发者 Hook，而不是静默失败。
3. 为 Provider、MCP、Nested Agent 分配子预算。

## 生产迁移

未来应将此模型重新设计为 `RunOptions` 和 `AgentRuntime` 的契约，不导入阶段代码。
