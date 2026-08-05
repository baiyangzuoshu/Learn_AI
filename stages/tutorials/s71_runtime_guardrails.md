# s71：生产 Runtime Guardrails

## 本课目标

把“模型应该自己停止”改成 Runtime
的硬约束：迭代、工具调用、输出字符和成本都有上限，取消信号在每次迭代前检查。

## 核心机制

- `RuntimeGuardrails` 保存单次运行的使用量。
- `BudgetExceeded` 明确指出哪一种资源耗尽。
- 预算属于执行策略，不应只写在 Prompt 中。

## 练习

1. 给 Provider、MCP、嵌套 Agent 分别分配子预算。
2. 增加 deadline、并发和上下文 token 预算。
3. 让超限事件写入 `HarnessEvent` 并显示在开发者 Trace 中。

## 生产边界

课程只演示计数器；生产需要准确 token/cost 计量、熔断、fallback 和跨进程预算传递。
