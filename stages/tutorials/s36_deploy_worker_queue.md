# s36：Provider Routing and Resilience

## 合并范围

整合多 Provider、OpenAI-compatible 适配、成本/延迟路由、Fallback 与 Circuit Breaker。

## 学习重点

模型不是静态配置。路由根据能力、质量、延迟、成本、可用性和失败状态选择；连续失败后打开
Circuit，Fallback 仍受预算限制。

## 练习

1. 增加视觉、函数调用、JSON Schema 和上下文窗口能力。
2. 按租户或任务类型分配成本配额。
3. 在 Trace 中记录选择和降级原因。

## 生产迁移

凭据只能存在安全存储或环境变量中，不能进入 Telemetry、聊天记录或 UI 状态。
