# s05：Todo 任务清单

源码：[s05_todo_write.ts](../s05_todo_write.ts)

## 学习目标

- 理解临时计划如何帮助模型处理多步骤任务。
- 掌握 Todo 的状态约束与展示事件。
- 区分临时 Todo 和持久任务图。

## 核心机制

`todo_write` 接收任务数组，常见状态为 `pending`、`in_progress` 和 `completed`。Todo
用于当前运行的短期进度，不承担跨会话恢复；长期依赖关系将在 s12 处理。

## 运行与观察

```sh
deno task s05
```

要求 Agent 完成三个步骤，观察它何时创建清单、更新当前任务并标记完成。

## 练习

增加规则：同一时间最多只能有一个 `in_progress` 任务。
