# s07：按需加载 Skill

源码：[s07_skill_loading.ts](../s07_skill_loading.ts)

## 学习目标

- 理解 Skill 是可复用的任务说明，而不是可执行工具。
- 掌握 Skill 发现与 `SKILL.md` 按需加载。
- 避免把所有 Skill 内容永久放入上下文。

## 核心机制

`list_skills` 只返回可用名称，`load_skill` 才读取选中的
`SKILL.md`。这种渐进加载减少上下文占用，也让模型根据任务选择适用流程。

## 运行与观察

```sh
deno task s07
```

在工作区创建一个测试 Skill，先列出再加载，确认非法名称和不存在的 Skill 会被拒绝。

## 练习

给 Skill 增加版本、适用条件和依赖 Skill 元数据。
