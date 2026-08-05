# s42：A2A Agent-to-Agent 协议

## 本课目标

团队邮箱和本地 handoff 解决的是进程内协作；A2A 解决的是跨 Agent
服务的发现、鉴权、任务状态和结果交付。

## 代码地图

- `AgentCard`：声明 Agent 身份、URL、技能和认证方式。
- `A2ATask`：记录 submitted、working、input-required、completed、failed、canceled。
- `transitionTask`：拒绝非法状态跳转。
- `addArtifact`：在任务历史中保存可验证结果。

## 运行

```sh
deno check stages/s42_a2a_protocol.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s42_a2a_protocol.ts
```

## 关键问题

Agent Card 不是 Prompt；它是服务契约。任务状态也不能由模型自由拼写，必须由状态机控制。Artifact
要有来源、版本和大小上限。

## 练习

- 增加 bearer token 的 audience、过期时间和租户检查。
- 增加流式 task update 与客户端重连。
- 让 `input-required` 暂停任务并等待用户确认。

## 与生产的边界

本课只展示协议数据结构，未绑定网络服务器。生产需要 TLS、认证、重试、幂等键、Artifact 存储和跨服务
Trace。
