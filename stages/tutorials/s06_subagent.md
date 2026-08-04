# s06：Subagent 委派

源码：[s06_subagent.ts](../s06_subagent.ts)

## 学习目标

- 理解主 Agent 如何把聚焦任务委派给子 Agent。
- 理解为什么子 Agent 复用同一个 Agent Loop。
- 掌握递归委派限制和取消传播。

## 核心机制

`subagent` 将任务包装成更窄的提示，再调用同一个
`agentLoop()`。异步上下文标记当前已经处于委派中，阻止子 Agent 继续无限创建子 Agent。

## 运行与观察

```sh
deno task s06
```

让主 Agent 委派一个只读代码分析任务，观察主任务与子任务的输入边界。

## 练习

增加子 Agent 的工具白名单和最大 Token 预算。
