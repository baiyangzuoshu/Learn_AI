# s09 Memory: Node.js + DeepSeek

这是 `learn-claude-code/s09_memory` 的 Node.js + DeepSeek 版。

s09 在 s08 的 context compact 之后增加一层持久记忆。压缩会丢细节，memory 负责把跨压缩、跨会话仍然有用的信息保存到文件系统。

## 存储结构

```text
00/.memory/
  MEMORY.md
  user-preference-tabs.md
  project-auth-context.md
```

每个记忆文件是 Markdown + frontmatter：

```md
---
name: user-preference-tabs
description: User prefers tabs for indentation
type: user
---

User prefers using tabs, not spaces, for indentation.
```

`MEMORY.md` 是索引，会被放进 system prompt。完整记忆内容只在相关时注入当前用户回合。

## 四类记忆

| 类型 | 用途 |
| --- | --- |
| `user` | 用户长期偏好 |
| `feedback` | 用户对工作方式的反馈 |
| `project` | 项目事实和背景 |
| `reference` | 外部链接、任务编号、排查入口 |

## 流程

```text
用户输入
  -> system prompt 带 MEMORY.md 索引
  -> 选择相关记忆并注入当前 user turn
  -> 正常 agent loop + context compact
  -> 回合结束后提取新记忆
  -> 记忆太多时合并整理
```

## 运行

```sh
cd 00
npm run s09
```

## 试用 prompt

```text
I prefer using tabs for indentation, not spaces. Remember that.
What did I tell you about my preferences?
I also prefer single quotes over double quotes for strings.
```
