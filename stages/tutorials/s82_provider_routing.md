# s82：Provider Capability Routing

## 本课目标

不再只按 Provider 名称选择模型，而是按能力、质量、延迟、成本和熔断状态路由。

## 核心机制

- `ProviderProfile` 声明能力和运营指标。
- 不满足约束的模型不会被选择。
- 连续失败会进入 circuit，避免对故障端点无限重试。

## 练习

1. 接入 DeepSeek、Mimo 和 OpenAI-compatible 的真实 capability profile。
2. 加入 fallback、指数退避和按租户成本预算。
3. 将路由决定和实际 token/cost/latency 写入评估数据。

## 生产边界

课程只做静态排序；生产需要实时健康、价格、限额、模型版本和区域路由。
