# s01 Agent Loop: Node.js + DeepSeek

这是 `learn-claude-code/s01_agent_loop` 的 Node.js 版最小 agent loop。

核心逻辑：

```js
while (true) {
  const response = await chat(messages);
  messages.push(response.message);

  if (!response.message.tool_calls?.length) return;

  executeTools();
  messages.push(toolResults);
}
```

DeepSeek 使用 OpenAI-compatible Chat Completions 格式，所以这里不是读取
Anthropic 的 `response.stop_reason == "tool_use"`，而是检查 assistant message
里是否存在 `tool_calls`。

## 运行

```sh
cd 00
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm start
```

不需要安装依赖。代码使用 Node.js 18+ 内置的 `fetch`。

## 配置

```sh
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 试用 prompt

```text
List files in this directory
Create hello.js that prints Hello World
What is the current git branch?
```

注意：这个 demo 会执行模型生成的 shell 命令，只做了很粗的危险命令拦截。真正的权限系统应在后续章节实现。
