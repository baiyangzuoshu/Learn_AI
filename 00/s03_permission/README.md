# s03 Permission: Node.js + DeepSeek

这是 `learn-claude-code/s03_permission` 的 Node.js + DeepSeek 版。

s03 建立在 s02 的 5 个工具之上，agent loop 仍然不变，只是在工具真正执行前插入 `checkPermission()`。

```js
const allowed = await checkPermission(name, args);
if (!allowed) return "Permission denied.";

const result = await toolHandlers[name](args);
```

## 三道闸门

| 闸门 | 作用 | 结果 |
| --- | --- | --- |
| Deny list | 永远禁止的命令，如 `sudo`、`rm -rf /` | 直接拒绝 |
| Rule match | 识别需要用户确认的操作，如 `rm file` | 进入确认 |
| User approval | 暂停并询问用户 `Allow? [y/N]` | 允许或拒绝 |

## 运行

```sh
cd 00
npm run s03
```

需要 `00/.env` 中配置：

```sh
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 试用 prompt

```text
Create a file called permission-test.txt in the current directory
Delete permission-test.txt
What files are in this directory?
Try to write a file to /etc/something
```

注意：这里仍然是教学级权限系统。`bash` 的危险命令识别只是简单字符串匹配，不能当成真正的安全沙箱。
