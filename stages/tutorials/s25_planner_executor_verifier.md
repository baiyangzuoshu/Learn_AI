# s25：Planner–Executor–Verifier

源码：[s25_planner_executor_verifier.ts](../s25_planner_executor_verifier.ts)

## 学习目标

- 将规划、执行和验证分成独立阶段。
- 校验依赖引用并拒绝循环依赖。
- 找出当前可执行与被失败依赖阻塞的任务。

## 核心机制

`plan_analyze` 构建节点映射，通过深度优先遍历检测环，再根据依赖状态计算 `ready` 和
`blocked`。计划有效不代表任务完成，完成仍需外部证据。

## 三个责任不要混在一起

Planner 把目标变成带依赖与成功标准的节点；Executor 只执行当前 ready 节点；Verifier
根据独立证据决定是否完成。若执行者可以凭一句“做完了”修改状态，计划图只是漂亮的 Todo。

`analyzePlan()` 先构建 ID Map，检查唯一性、格式和依赖存在；DFS 使用 `visiting/visited`
检测环；随后从状态与依赖推导 `ready` 和 `blocked`。这一步只验证计划结构，不执行节点，也不证明
completed 状态真实。

合理循环是：验证计划 → 选择 ready 节点 → 在预算内执行 → 收集文件、测试或外部状态证据 → Verifier 判定
→ 更新状态 → 必要时修订计划。修订应保留历史，避免失败后偷偷改写成功标准。

Planner 不应把所有未来细节一次写死。信息不足的远期节点可以保持粗粒度，到依赖完成后再展开。

## 运行与观察

```sh
deno task s25
```

分别输入合法依赖链、缺失依赖和 A↔B 循环，观察验证结果。

## 局限与练习

为节点增加不可由 Executor 自行修改的成功标准和证据字段；实现 Verifier
驱动的状态转换与计划修订历史，并测试失败依赖如何传播阻塞。
