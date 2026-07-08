# s07 Skill Loading: Node.js + DeepSeek

这是 `learn-claude-code/s07_skill_loading` 的 Node.js + DeepSeek 版。

s07 在 s06 的子 Agent 基础上增加按需知识加载：

| 层 | 什么时候进入上下文 | 内容 |
| --- | --- | --- |
| Skill catalog | 启动时放进 system prompt | 技能名 + 一行描述 |
| Full skill | 模型调用 `load_skill` 时 | 完整 `SKILL.md` |

## 技能目录

技能放在：

```text
00/skills/<skill-name>/SKILL.md
```

每个 `SKILL.md` 可以带 frontmatter：

```md
---
name: code-review
description: Perform thorough code reviews.
---

# Code Review Skill
...
```

启动时 harness 扫描 `00/skills`，把目录注入 system prompt。完整内容不会提前塞进 prompt，只有模型调用 `load_skill` 时才进入对话。

## 新工具

```text
load_skill({ name })
```

它通过启动时建立的 registry 查找技能名，不接受任意文件路径，所以不会产生路径遍历问题。

## 运行

```sh
cd 00
npm run s07
```

## 试用 prompt

```text
What skills are available?
Load the code-review skill and follow its instructions
I need to build an MCP server -- load the relevant skill first
```
