# s84：A2A Gateway

## 本课目标

将远程 Agent 协作放到明确网关之后。网关负责 Caller 身份、Tenant、幂等键、任务持久化和
Trace，而不是让模型直接访问任意 Agent URL。

## 关键设计

`GatewayRequest` 里必须携带调用者、租户、幂等键和
Trace。相同租户与幂等键返回同一个任务，从而让网络重试不产生双重副作用。

## 练习

1. 设计 Agent Card 缓存、能力版本和过期策略。
2. 增加 Artifact URI、SSE 事件和终态不可变规则。
3. 对跨租户、失效凭据和重复投递编写负例。

## 生产边界

课程用 Map 模拟仓储；生产需要 TLS、JWT/mTLS、持久化数据库、速率限制和任务审计。
