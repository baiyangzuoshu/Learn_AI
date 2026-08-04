# s26：MCP 能力协商

源码：[s26_mcp_capability_negotiation.ts](../s26_mcp_capability_negotiation.ts)

## 学习目标

- 验证 MCP 初始化结果的协议版本和 Server 信息。
- 根据 Server 声明决定可调用的方法。
- 避免假定每个 MCP Server 都支持全部能力。

## 核心机制

`mcp_capability_check` 检查 `protocolVersion`、`serverInfo` 和 `capabilities`，将所需能力分成
`supported` 与 `missing`，并报告 tools、resources、prompts 和 logging 支持情况。

## 连接成功不代表方法可用

不同 MCP Server 可能只支持 tools、resources、prompts 或 logging 的一部分。Client
若按固定全功能接口调用，会把正常的能力缺失误当故障。初始化响应就是运行时契约协商。

`mcp_capability_check` 验证日期格式的 `protocolVersion`、非空 `serverInfo.name` 和对象形式的
`capabilities`，再把调用方需求分成 `supported` 与
`missing`，并导出可用方法族。这让上层可以禁用入口、选择降级方案或明确报告缺失，而不是先调用再猜错误。

能力对象表示 Server 声明，不等于它值得信任或当前健康。生产 Client
还要验证协议版本兼容性、Schema、认证、超时和实际调用结果，并在重连后重新协商。Server
的能力可能变化，缓存必须绑定会话。

s19 展示 MCP 基本会话，本课强调调用前的契约判断；两者组合才是健壮 Client。

## 运行与观察

```sh
deno task s26
```

构造不同的 initialize 结果，确认缺少资源能力时不会建议调用 `resources/read`。

## 局限与练习

连接真实 initialize 流程，加入协议兼容表和能力快照。模拟重连后 capabilities
改变，确认旧缓存失效，缺失功能采用明确降级而非盲调方法。
