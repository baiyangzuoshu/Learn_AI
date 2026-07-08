# s05 TodoWrite: Node.js + DeepSeek

这是 `learn-claude-code/s05_todo_write` 的 Node.js + DeepSeek 版。

s05 在 s04 的 hook 结构上增加一个规划工具：`todo_write`。这个工具不读文件、不写文件、不执行命令，只维护当前会话的任务列表，让模型在复杂任务前先列计划、执行中持续更新状态。

```js
todo_write({
  todos: [
    { content: "Read existing files", status: "pending" },
    { content: "Implement change", status: "pending" },
    { content: "Run check", status: "pending" }
  ]
});
```

## 状态

每个 todo 只有三种状态：

| 状态 | 含义 |
| --- | --- |
| `pending` | 还没开始 |
| `in_progress` | 正在做 |
| `completed` | 已完成 |

## Nag Reminder

`s05` 还加入了一个教学用提醒机制：

```js
if (roundsSinceTodo >= 3) {
  messages.push({
    role: "user",
    content: "<reminder>Update your todos.</reminder>"
  });
}
```

也就是模型连续 3 轮工具调用都没有更新 `todo_write` 时，下一轮会自动收到提醒。

## 运行

```sh
cd 00
npm run s05
```

需要 `00/.env` 中配置 DeepSeek：

```sh
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 试用 prompt

```text
Create a small Node package under tmp/demo_pkg with index.js and a smoke test
Review JavaScript files under s05_todo_write and suggest style fixes
Create tmp/hello.js that prints hello, then run it
```
