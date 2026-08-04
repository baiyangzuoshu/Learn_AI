# s25：Planner–Executor–Verifier

源码：[s25_planner_executor_verifier.ts](../s25_planner_executor_verifier.ts)

## 学习目标

- 将规划、执行和验证分成独立阶段。
- 校验依赖引用并拒绝循环依赖。
- 找出当前可执行与被失败依赖阻塞的任务。

## 核心机制

`plan_analyze` 构建节点映射，通过深度优先遍历检测环，再根据依赖状态计算 `ready` 和
`blocked`。计划有效不代表任务完成，完成仍需外部证据。

## 运行与观察

```sh
deno task s25
```

分别输入合法依赖链、缺失依赖和 A↔B 循环，观察验证结果。

## 局限与练习

为节点增加成功标准与证据，让 Verifier 决定状态转换，并在失败后生成修订计划。
