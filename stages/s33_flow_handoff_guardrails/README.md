# 33: Deployment Topology — 延迟决定通信方式

[← s32](../s32_reasoning_strategies/README.md) · [课程地图](../README.md) ·
[s34 →](../s34_hybrid_rag/README.md)

> “实时、交互和异步任务不该走同一条管线”
>
> 生产层：部署拓扑。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

把长任务留在 HTTP 请求中会超时，把普通问答都送队列又会破坏交互体验。

## 解决方案

按 latency class 选择 embedded/WebSocket、API/SSE 或 durable queue/Worker。

## 工作原理

1. 实时交互使用低延迟双向通道。
2. 流式问答使用 HTTP+SSE。
3. 长任务写入持久队列。
4. Front Door 只做轻路由和取消。

### 执行链

```text
client → front door → embedded/API/worker → shared trace
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s33`
- 类型检查：`deno check stages/s33_flow_handoff_guardrails/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

为三种延迟类型调用 chooseDelivery，并解释客户端断开时取消应传播到哪里。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产需要 loopback 绑定、请求校验、SSE 已关闭流保护、backpressure、graceful
shutdown、健康端点和真实平台验证。

生产迁移必须通过 `AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和独立 `HarnessFeature`
完成；禁止从 `src/` 或 `desktop/` 直接导入课程代码。

## 动手练习

1. 修改一个阈值或状态转移，写下预期结果并运行本章验证。
2. 增加一个负例，确认失败会留下可定位证据，而不是被吞掉或误报成功。
3. 把本章机制映射到生产模块，列出契约、持久化、权限、Trace、取消和回滚要求。

## 过关标准

- 能画出执行链并解释每个边界由谁强制。
- 能指出示例中的占位实现和至少三项生产缺口。
- 能给出一条可自动化的验收证据，而不是“人工看起来没问题”。

## 下一章

进入 [s34 →](../s34_hybrid_rag/README.md)，继续补齐生产 Agent 的下一层约束。
