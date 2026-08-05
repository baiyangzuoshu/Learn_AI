# s38：成本、延迟与模型路由

## 要解决的问题

“最强模型”不是所有请求的最优解。模型选择会影响成本、延迟、质量、速率限制和用户体验，因此需要可解释的策略，而不是散落在代码里的
if/else。

## 代码地图

- `estimateCost`：按输入/输出 token 与单价估算一次调用成本。
- `routeModel`：先满足质量与延迟 SLO，再按估算成本排序。
- `cacheKey`：为确定性 prompt 生成稳定键，展示缓存边界。
- `cost_latency_route`：输出选择和缓存键。

## 运行

```sh
deno check stages/s38_cost_latency_routing.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s38_cost_latency_routing.ts
```

把质量要求设为 0.9、延迟上限设为 500ms，观察没有模型满足时返回 null。这个“拒绝路由”比静默违反 SLO
更容易监控。

## 生产策略

路由输入应包含任务类型、上下文长度、预算、租户等级、当前配额和降级策略。缓存必须绑定模型版本、系统提示版本和工具
schema；否则旧结果会污染新行为。

## 练习

1. 加入 token 上限，过长上下文自动转摘要模型。
2. 记录 route decision 与实际 latency/cost，比较估算误差。
3. 实现熔断：某 provider 连续失败时暂时移出候选。

## 与生产的边界

课程价格是静态数字，不能代表真实供应商价格。生产应从配置读取价格、隐藏用户级成本细节，并在 provider
失败时保留取消信号与重试上限。
