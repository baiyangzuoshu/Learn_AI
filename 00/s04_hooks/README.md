# s04 Hooks: Node.js + DeepSeek

这是 `learn-claude-code/s04_hooks` 的 Node.js + DeepSeek 版。

s04 不新增模型能力，也不新增核心工具。它把扩展逻辑从 agent loop 里移出来，挂到 hook 注册表上。

```js
registerHook("PreToolUse", permissionHook);
registerHook("PreToolUse", logHook);
registerHook("PostToolUse", largeOutputHook);
registerHook("Stop", summaryHook);
```

## Hook 事件

| 事件 | 触发时机 | 当前 demo 用途 |
| --- | --- | --- |
| `UserPromptSubmit` | 用户输入后、进入 LLM 前 | 打印当前工作目录 |
| `PreToolUse` | 工具执行前 | 权限检查、日志 |
| `PostToolUse` | 工具执行后 | 大输出提醒 |
| `Stop` | 模型不再调用工具、循环退出前 | 打印工具调用统计 |

## 与 s03 的差异

s03 在循环里直接调用权限检查：

```js
const allowed = await checkPermission(name, args);
```

s04 改为触发 hook：

```js
const blocked = await triggerHooks("PreToolUse", toolCall);
if (blocked) return String(blocked);
```

这样以后要加日志、审计、自动格式化、自动 `git add` 等扩展时，只需要注册 hook，不需要继续改 agent loop。

## 运行

```sh
cd 00
npm run s04
```

需要 `00/.env` 中配置 DeepSeek：

```sh
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 试用 prompt

```text
Read package.json
Create a file called hook-test.txt
Delete hook-test.txt
Find all JavaScript files
```
