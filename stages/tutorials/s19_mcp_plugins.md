# s19：MCP 工具集成

源码：[s19_mcp_plugins.ts](../s19_mcp_plugins.ts)

## 学习目标

- 理解 MCP Client、Server 和工具发现关系。
- 掌握初始化、会话 ID、`tools/list` 与 `tools/call`。
- 安全处理远程 URL 和不可信响应。

## 核心机制

阶段从工作区配置读取 MCP Server，先执行 `initialize` 和 initialized
通知，再发现或调用工具。远程连接要求 HTTPS，本地开发允许 localhost HTTP，并限制错误和输出长度。

## MCP 接入的是协议，不是信任

MCP 让外部 Server 通过统一协议声明工具，Client 不必为每个服务手写专用调用代码。典型会话顺序是
`initialize`、发送 initialized 通知、`tools/list`、再根据工具名执行 `tools/call`。

本课从工作区配置读取 Server，维护会话 ID，并限制 URL、响应和错误长度。远程端点必须 HTTPS，只有
localhost 开发允许 HTTP。Server 返回的工具描述、Schema
与结果都属于外部不可信数据，必须验证后才能并入本地工具池。

MCP 工具不应绕过 s03：只读、变更、外部效果和危险操作仍需分类。工具列表还可能在会话期间变化，因此真实
Client 要处理能力协商、列表刷新、超时、认证、重连与关闭。

Resources 是可读取上下文，Prompts 是服务端提供的模板，Tools
是动作；三者语义不同，不能全部粗暴映射成可执行函数。

## 运行与观察

```sh
deno task s19
```

配置一个本地 MCP Server，依次调用 `mcp_servers`、`mcp_list_tools` 和 `mcp_call`。

## 练习

增加 `resources/list/read`、`prompts/list`、连接超时和会话关闭。让 Server 返回畸形 Schema
与超长结果，验证 Client 在注册或展示前拒绝/截断。
