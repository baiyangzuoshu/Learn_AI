# s27：A2A, Handoff, and Teams

## 合并范围

整合 Subagent、Team、Flow、Handoff、A2A、Gateway、Artifact 和协作 Worker。

## 学习重点

交接传递的是角色、目标、租户、权限、Trace 和证据，不是“帮我看看”。Gateway
用幂等键和任务状态防止网络重试造成重复副作用。

## 练习

1. 加入 Agent Card、Capability 版本和事件流。
2. 为并行专家添加 role scope 与总预算。
3. 测试失败、超时、取消和 Artifact 上限。

## 生产迁移

生产需使用 TLS、身份验证、持久任务仓储和跨进程 Trace。
