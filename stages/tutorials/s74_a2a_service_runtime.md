# s74：Repository-backed A2A Service

## 本课目标

把 A2A Handler 变成可恢复的服务：Agent Card、认证、任务仓储、状态、Artifact 和事件都拥有明确边界。

## 核心机制

- `TaskRepository` 隔离 HTTP 层和持久化层。
- 任务状态和 Artifact 持久化，客户端断线后仍可查询。
- 终态任务拒绝再次修改，避免重复副作用。

## 练习

1. 增加幂等键、任务事件 SSE 和分页查询。
2. 实现 A2A Client 的重试和能力协商。
3. 将仓储替换为原子 JSON 或数据库，并加入租户过滤。

## 生产边界

本课仓储仍是 Map；生产需要真正服务进程、TLS、身份、并发控制、Artifact 存储和故障恢复。
