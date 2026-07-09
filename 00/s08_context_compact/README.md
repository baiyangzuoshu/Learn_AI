# s08 Context Compact: Node.js + DeepSeek

这是 `learn-claude-code/s08_context_compact` 的 Node.js + DeepSeek 版。

s08 在 s07 的 skill loading 和 subagent 基础上加入上下文压缩管线。核心原则是：便宜的先跑，贵的后跑。

## 压缩顺序

每次 LLM 调用前执行：

```text
tool_result_budget -> snip_compact -> micro_compact -> compact_history
```

| 层 | 作用 | 是否调用 LLM |
| --- | --- | --- |
| `tool_result_budget` | 最近一批大工具输出落盘，只保留预览 | 否 |
| `snip_compact` | 消息数超过 50 时裁掉中间历史 | 否 |
| `micro_compact` | 旧 tool result 替换为占位符 | 否 |
| `compact_history` | 仍超过阈值时生成摘要 | 是 |

## 输出目录

```text
00/.task_outputs/tool-results/
00/.transcripts/
```

大工具输出会落盘到 `.task_outputs/tool-results/`。全量 transcript 会落盘到 `.transcripts/`，方便恢复或调试。

## 新工具

```text
compact({ focus? })
```

模型可以主动调用它，请求把历史摘要化。

## 运行

```sh
cd 00
npm run s08
```

## 试用 prompt

```text
Read package.json, then read every README under s01 through s08
Read every file under s08_context_compact
Use compact to summarize the session so far
```
