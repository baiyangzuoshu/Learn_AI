# s48：实时通信与部署选择

## 本课目标

部署方式应由消费方式决定：嵌入式实时交互、API 请求响应、事件驱动长任务、MCP 工具或 A2A Agent
服务并不共享同一条通信线。

## 代码地图

- `chooseWire`：根据延迟、流式和后台特征选择 HTTP/SSE/WebRTC/Queue。
- `chooseDeployment`：选择 embedded、api、event-driven、mcp 或 a2a。
- `sseEvent`：展示流式事件协议。
- `healthSnapshot`：将依赖状态纳入健康检查。

## 运行

```sh
deno check stages/s48_realtime_deployment.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s48_realtime_deployment.ts
```

## 练习

- 增加 WebSocket 的连接、心跳、断线重连和背压。
- 把长任务切换到队列，并让客户端用 requestId 查询状态。
- 为 prompt、tool、model 写 release manifest 和 rollback 规则。

## 与生产的边界

课程只生成协议文本和健康快照。生产还需要
Docker/Compose、容器资源限制、TLS、负载均衡、SLO、可观测性和跨版本兼容。
