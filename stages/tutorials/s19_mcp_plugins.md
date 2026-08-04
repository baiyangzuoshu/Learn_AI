# s19：MCP 工具集成

源码：[s19_mcp_plugins.ts](../s19_mcp_plugins.ts)

## 学习目标

- 理解 MCP Client、Server 和工具发现关系。
- 掌握初始化、会话 ID、`tools/list` 与 `tools/call`。
- 安全处理远程 URL 和不可信响应。

## 核心机制

阶段从工作区配置读取 MCP Server，先执行 `initialize` 和 initialized
通知，再发现或调用工具。远程连接要求 HTTPS，本地开发允许 localhost HTTP，并限制错误和输出长度。

## 运行与观察

```sh
deno task s19
```

配置一个本地 MCP Server，依次调用 `mcp_servers`、`mcp_list_tools` 和 `mcp_call`。

## 练习

增加 `resources/list`、`resources/read`、`prompts/list` 和连接超时。
