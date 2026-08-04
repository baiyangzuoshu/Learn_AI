# s26：MCP 能力协商

源码：[s26_mcp_capability_negotiation.ts](../s26_mcp_capability_negotiation.ts)

## 学习目标

- 验证 MCP 初始化结果的协议版本和 Server 信息。
- 根据 Server 声明决定可调用的方法。
- 避免假定每个 MCP Server 都支持全部能力。

## 核心机制

`mcp_capability_check` 检查 `protocolVersion`、`serverInfo` 和 `capabilities`，将所需能力分成
`supported` 与 `missing`，并报告 tools、resources、prompts 和 logging 支持情况。

## 运行与观察

```sh
deno task s26
```

构造不同的 initialize 结果，确认缺少资源能力时不会建议调用 `resources/read`。

## 局限与练习

把检查连接到真实 MCP Session，加入版本兼容表、认证、重连与会话关闭。
