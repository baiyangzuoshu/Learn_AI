# s12：持久任务图

源码：[s12_persistent_task_graph.ts](../s12_persistent_task_graph.ts)

## 学习目标

- 用任务节点和依赖关系表示长期工作。
- 掌握按工作区持久化和原子写入。
- 区分任务图与当前运行 Todo。

## 核心机制

`task_graph_read` 读取持久图，`task_graph_write` 校验节点 ID
和依赖后整体写入。任务图适合跨会话项目计划，Todo 适合当前运行的短期进度。

## 运行与观察

```sh
deno task s12
```

创建“分析 → 实现 → 验证”依赖链，重启后确认仍能读取。

## 练习

加入依赖环检测，并计算当前可以执行的节点集合。
