# 31: Security Boundary — 身份、沙箱、出口与 DLP

[← s30](../s30_production_readiness/README.md) · [课程地图](../README.md) ·
[s32 →](../s32_reasoning_strategies/README.md)

> “安全规则必须在执行时生效”
>
> 生产层：安全边界。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

Prompt 中写“不要泄密”无法阻止过期身份、路径逃逸、SSRF 或日志中的明文凭据。

## 解决方案

在执行面校验身份 scope、租户、HTTPS 出口 allowlist，并在日志与外发前脱敏。

## 工作原理

1. 验证 Identity 过期与 scope。
2. 规范化工作区路径。
3. 限制 HTTPS 主机和目标。
4. 记录脱敏的允许或拒绝事件。

### 执行链

```text
request → identity/path/egress policy → redact → execute or deny → audit
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s31`
- 类型检查：`deno check stages/s31_structured_io/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

测试过期身份、非 allowlist 主机和疑似 API Key，确认拒绝与脱敏发生在正确边界。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产还需要 JWT/JWKS、OS/容器沙箱、出口代理、密钥管理、DNS rebinding 防护、策略版本和人工审批。

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

进入 [s32 →](../s32_reasoning_strategies/README.md)，继续补齐生产 Agent 的下一层约束。
