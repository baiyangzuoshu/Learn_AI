# s10：系统提示组装

源码：[s10_system_prompt.ts](../s10_system_prompt.ts)

## 学习目标

- 理解系统提示由多个独立能力段组成。
- 掌握稳定 ID、标题和优先级排序。
- 避免将所有规则硬编码在 Agent Loop 中。

## 核心机制

各阶段通过 `registerSystemPromptSection()`
注册提示段，组装时加入核心身份并按优先级排序。`SystemPromptAssembled` Hook
记录段数和长度，而不是泄露完整提示。

## 运行与观察

```sh
deno task s10
```

查看系统提示快照，确认核心身份先于具体能力规则，同一优先级按稳定 ID 排序。

## 练习

增加重复 ID 检查，并为提示段建立版本和测试用例。
