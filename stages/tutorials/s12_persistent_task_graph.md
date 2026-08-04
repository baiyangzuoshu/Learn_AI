# s12：持久任务图

源码：[s12_persistent_task_graph.ts](../s12_persistent_task_graph.ts)

## 学习目标

- 用任务节点和依赖关系表示长期工作。
- 掌握按工作区持久化和原子写入。
- 区分任务图与当前运行 Todo。

## 核心机制

`task_graph_read` 读取持久图，`task_graph_write` 校验节点 ID
和依赖后整体写入。任务图适合跨会话项目计划，Todo 适合当前运行的短期进度。

## 为什么 Todo 不够

长任务可能跨越进程、会话和多个 Agent。线性 Todo 既表达不了依赖，也无法在重启后恢复。Task Graph
用稳定节点 ID、状态和 `dependsOn` 描述“哪些工作必须先完成”，并将整个状态按工作区持久化。

本课通过 `task_graph_read` 与 `task_graph_write` 暴露整体读写。写入前验证节点结构、ID
唯一性、依赖存在和状态；随后用临时文件加 `rename` 原子替换，避免崩溃留下半个
JSON。工作区摘要保证不同项目不共用任务数据。

图的关键推导是“可执行集合”：状态为 pending 且全部依赖 completed
的节点可以认领；依赖失败的节点被阻塞；环形依赖必须拒绝，否则没有起点。并发写入还需要版本号或锁，否则两个
Agent 会发生最后写入者覆盖。

Task Graph 管持久目标，Todo 管单次执行焦点。Agent 领取图节点后，仍可用 Todo 细分当前工作。

## 运行与观察

```sh
deno task s12
```

创建“分析 → 实现 → 验证”依赖链，重启后确认仍能读取。

## 练习

加入 DFS 环检测和 ready/blocked 计算；再加入 `revision` 乐观锁，模拟两个 Agent
同时更新并确认旧版本写入被拒绝。
