# s27：Handoff 护栏

源码：[s27_handoff_guardrails.ts](../s27_handoff_guardrails.ts)

## 学习目标

- 用结构化信封表达 Agent 交接。
- 在交接时保留目标、证据、工具权限和预算。
- 拒绝含糊、自我交接和无证据交接。

## 核心机制

`handoff_validate` 校验发送者、接收者、目标、证据、工具白名单和工具预算，成功后生成唯一 Handoff
ID。它是流转前护栏，不负责执行目标 Agent。

## 运行与观察

```sh
deno task s27
```

比较完整交接、无证据交接和发送者等于接收者三种输入。

## 局限与练习

增加接收方输出 Schema、交接确认、超时回退和责任链审计。
