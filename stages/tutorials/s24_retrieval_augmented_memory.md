# s24：Task State, Checkpoint, and Replay

## 合并范围

整合 Todo、任务图、Planner/Executor/Verifier、Checkpoint、幂等和循环控制。

## 学习重点

长任务以目标、状态和证据表示。Checkpoint
保存已验证事实；恢复时读取证据，而不是重复副作用。只有具有证据的任务才能进入 verified。

## 练习

1. 为每次工具调用增加 idempotency key。
2. 持久化依赖图并支持崩溃恢复。
3. 区分“失败可重试”“需要人工输入”“完成”。

## 生产迁移

使用原子存储和 Workspace 边界，避免将任务状态混入聊天记录。
