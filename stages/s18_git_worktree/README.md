# 18: Git Worktree — 文件系统也要隔离

[← s17](../s17_autonomous_agent/README.md) · [课程地图](../README.md) ·
[s19 →](../s19_mcp_plugins/README.md)

> “任务隔离目标，Worktree 隔离目录”
>
> Harness 层：工作区隔离。本章只增加一个机制，Agent 的核心决策循环保持不变。

## 本章目标

学完后，你应该能解释这个机制解决的具体问题、指出它插入 Agent Loop
的位置，并能修改一个约束后验证行为变化。

## 问题

多个 Agent 在同一目录并行修改，即使任务不同也可能覆盖文件、污染索引或读到中间状态。

## 解决方案

为任务创建独立分支与 Worktree，把 workspace 显式传入同一个 Agent Loop，并拒绝删除脏目录。

## 工作原理

1. 验证任务 ID 与仓库根。
2. 创建受管理路径和分支。
3. 在隔离 workspace 运行 Agent。
4. 删除前检查未提交状态。

### 执行链

```text
task id → branch/worktree → isolated agent → inspect → safe remove
```

模型负责决定下一步，Harness 负责校验、执行、记录和限制。失败也作为观察返回模型，而不是被隐藏。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s18`
- 类型检查：`deno check stages/s18_git_worktree/code.ts`

沿着注册点、输入校验、执行函数和 `agentLoop()`
四处阅读。先找到本章新增的状态或工具，再追踪它如何复用前一章。

## 观察清单

创建 Worktree 后制造未提交修改，确认 remove 被拒绝，并观察父工作区是否保持不变。

建议同时记录：模型看见了什么 Schema、Harness
实际执行了什么、结果如何回到消息历史，以及取消或失败发生在哪一层。

## 边界与生产差距

生产要在重启后恢复管理记录、校验根目录、处理进程占用，并提供可审计的合并与冲突上报。

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

进入 [s19 →](../s19_mcp_plugins/README.md)，在同一个 Loop 上继续增加下一项能力。

## 课程图

![s18_git_worktree 执行链](images/overview.svg)

图中把本章新增机制放在统一 Agent Loop
的边界上；阅读代码时，沿箭头核对输入、执行、限制和证据是否一致。
