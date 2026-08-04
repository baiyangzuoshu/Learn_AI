# s05：Todo 任务清单

源码：[s05_todo_write.ts](../s05_todo_write.ts)

## 学习目标

- 理解临时计划如何帮助模型处理多步骤任务。
- 掌握 Todo 的状态约束与展示事件。
- 区分临时 Todo 和持久任务图。

## 核心机制

`todo_write` 接收任务数组，常见状态为 `pending`、`in_progress` 和 `completed`。Todo
用于当前运行的短期进度，不承担跨会话恢复；长期依赖关系将在 s12 处理。

## Todo 改变了什么

多步骤任务常见失败是遗忘原目标或局部完成后过早停止。`todo_write`
把隐含计划变成用户和模型都可观察的进度。它仍只是工具，不是硬编码工作流：模型负责拆分步骤，Handler
只验证结构并统计状态。

源码中的枚举把动作空间限制为 `pending`、`in_progress`、`completed`；逐项运行时校验证明 Schema
不能替代可信边界；`setSystemGuidance()` 则把使用原则作为独立提示段加入 Harness。

Todo 是一次运行的工作记忆，没有依赖边，也不会持久化。s12 的 Task Graph 才负责跨会话目标。不要用易失
Todo 承载数天计划，也不要为三个临时步骤引入复杂持久系统。

合理状态通常沿 `pending → in_progress → completed` 前进。单 Agent
可保持一个当前项，但并行团队可能需要多个执行中节点，约束应服从真实执行语义。

## 运行与观察

```sh
deno task s05
```

要求 Agent 完成三个步骤，观察它何时创建清单、更新当前任务并标记完成。

## 练习

增加规则：非空且未全部完成时恰好一个
`in_progress`。再加入非法回退测试，并思考并行执行时为什么需要放宽这个约束。
