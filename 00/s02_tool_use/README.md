# s02 Tool Use: Node.js + DeepSeek

这是 `learn-claude-code/s02_tool_use` 的 Node.js + DeepSeek 版。

s01 的 agent loop 不变，变化只有工具执行部分：从硬编码 `bash` 改为按工具名查表分发。

```js
const toolHandlers = {
  bash: runBash,
  read_file: runRead,
  write_file: runWrite,
  edit_file: runEdit,
  glob: runGlob,
};
```

DeepSeek 使用 OpenAI-compatible Chat Completions 格式，所以循环继续条件是 assistant message 里有没有 `tool_calls`，不是 Anthropic 的 `response.stop_reason == "tool_use"`。

## 运行

```sh
cd 00
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm run s02
```

## 工具

| 工具 | 用途 |
| --- | --- |
| `bash` | 执行 shell 命令 |
| `read_file` | 读取工作区文件，可传 `limit` 限制行数 |
| `write_file` | 写入工作区文件 |
| `edit_file` | 在文件中替换一次精确文本 |
| `glob` | 按 glob pattern 查找文件 |

文件工具使用 `safePath()` 限制路径不能逃出 `00` 项目根。`bash` 仍然只是教学级危险命令拦截，真正权限系统放到 s03。

## 试用 prompt

```text
Read package.json and tell me what scripts it has
Create tmp/hello.js that prints hello, then read it back
Find all JavaScript files in this workspace
Read README.md and package.json, then write a short summary to tmp/summary.md
```
