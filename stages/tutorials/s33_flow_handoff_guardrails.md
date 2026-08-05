# s33：Flow、Handoff 与 Guardrails

## 要解决的问题

多 Agent 系统最常见的失败不是“没有 Agent”，而是上下文交接含糊：下一个 Agent
不知道目标、已有证据、可用工具和验收条件。本课把路由和交接变成可验证的协议。

## 代码地图

- `route`：按任务意图选择 research/build/review 分支。
- `Handoff`：显式携带 task、objective、evidence、allowedTools、acceptance。
- `validateHandoff`：在边界拒绝空目标、空验收标准和危险工具。
- `guardrail`：把输入契约与输出大小一起检查。

## 运行

```sh
deno check stages/s33_flow_handoff_guardrails.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s33_flow_handoff_guardrails.ts
```

先用“review the patch”观察路由，再构造包含 `dangerous:shell` 的 handoff，确认 guardrail 拒绝它。

## 关键观察

路由只决定“谁先做”，不代表授权。授权仍需在工具执行前重新判断。handoff
是数据，不是信任边界；接收方要重新验证字段、工作区和权限。

## 练习

1. 增加 `parentRunId`、截止时间和最大 token 预算。
2. 将 acceptance 编译成可执行检查，而不是字符串。
3. 增加“拒绝后回到人工”的分支，避免 Agent 互相循环交接。

## 与生产的边界

生产实现应使用统一的 `RunOptions`、`ToolContext`
和事件协议。教学中的正则路由只用于演示，不能取代模型分类器、ACL 和审计记录。
