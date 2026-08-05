# s33：Deployment Topology and Streaming

## 合并范围

整合 Realtime Deployment、Deploy Service、API/SSE、Queue/Worker 与通信拓扑。

## 学习重点

交互延迟决定部署方式：实时走 WebSocket/WebRTC，流式问答走 HTTP+SSE，长任务走 Queue。Front Door
负责轻路由，复杂工作移交给受限 Worker。

## 练习

1. 设计 Loopback API、SSE 取消和客户端断开处理。
2. 添加 backpressure、graceful shutdown 和健康端点。
3. 绘制 UI、Gateway、Agent、MCP、Worker 的 Trace 链路。

## 生产迁移

容器化与 Compose 用于服务组合；跨平台构建不等于已完成原生运行验证。
