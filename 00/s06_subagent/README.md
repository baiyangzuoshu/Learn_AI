# s06 Subagent: Node.js + DeepSeek

这是 `learn-claude-code/s06_subagent` 的 Node.js + DeepSeek 版。

s06 在 s05 的工具和 hook 结构上新增 `task` 工具。父 Agent 调用 `task` 时，会启动一个子 Agent：

```text
parent messages[]  --task(description)-->  subagent messages[]
parent receives summary only  <----------  subagent final text
```

## 关键设计

| 设计 | 实现 |
| --- | --- |
| 上下文隔离 | 子 Agent 使用全新的 `messages[]` |
| 只回传结论 | 父 Agent 只收到子 Agent 最后的文本摘要 |
| 禁止递归 | 子 Agent 只有 `bash/read/write/edit/glob`，没有 `task` |
| 权限不跳过 | 子 Agent 工具调用仍会触发 `PreToolUse` hook |
| 安全上限 | 子 Agent 最多 30 轮 |

## 工具差异

父 Agent：

```text
bash, read_file, write_file, edit_file, glob, todo_write, task
```

子 Agent：

```text
bash, read_file, write_file, edit_file, glob
```

## 运行

```sh
cd 00
npm run s06
```

需要 `00/.env` 中配置 DeepSeek：

```sh
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 试用 prompt

```text
Use a subtask to find what scripts are defined in package.json
Delegate: read all JavaScript files under s06_subagent and summarize what each one does
Use a task to create tmp/string_tools.js with a slugify function, then verify it from the parent agent
```
