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

## Prompt 是可测试的运行时配置

能力增加后，一个巨型字符串会产生重复、顺序冲突和不可测试修改。Prompt Registry 把核心身份与 Feature
规则拆开：能力注册工具时也注册最小指导，移除能力时对应段落可以一起消失。

`registerSystemPromptSection()` 接受稳定 `id`、标题、`priority` 与正文；`systemPromptSnapshot()`
确定性排序和组装。同一配置必须得到同一
Prompt，才能缓存、复现和比较评测。优先级只决定出现顺序，并不能可靠解决语义冲突，因此冲突应在注册或测试阶段发现。

`SystemPromptAssembled` 只报告段数与长度，因为完整 Prompt
可能包含内部规则和敏感配置。可观察性不意味着记录一切。

应测试 ID 唯一、排序稳定、Feature 开关只改变对应段落、核心安全规则存在、总长度受控，并用 Eval
验证行为，而非只凭文字感觉。

## 运行与观察

```sh
deno task s10
```

查看系统提示快照，确认核心身份先于具体能力规则，同一优先级按稳定 ID 排序。

## 练习

增加重复 ID 拒绝、段落版本和总字符预算。生成启用与禁用某个 Feature 的
Snapshot，断言只有对应段落改变。
