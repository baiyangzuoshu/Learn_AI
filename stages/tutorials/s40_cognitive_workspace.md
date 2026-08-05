# s40：认知工作区、注意力与自适应

## 要解决的问题

上下文窗口有限，模型的“自信”也不等于证据充分。认知 Agent
需要持续决定哪些信息进入工作区、当前结论是否可靠，以及何时减速、验证或换策略。

## 代码地图

- `allocateAttention`：按 salience 排序，在 token budget 内选择上下文。
- `calibrate`：用证据支持和矛盾数量修正 confidence。
- `adapt`：从重复动作和近期错误推导 continue、slow-down-and-verify 或 pivot。
- `cognitive_workspace_monitor`：一次输出 focus、校准置信度和适应策略。

## 运行

```sh
deno check stages/s40_cognitive_workspace.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s40_cognitive_workspace.ts
```

传入 token 总量超过 budget 的多个工作区项目，观察低 salience 项被丢弃；把 contradictions 增加到
4，观察 confidence 下调。

## 监控闭环

1. Attention：选择当前任务最相关的事实，而不是永远保留全部历史。
2. Monitoring：记录证据数、矛盾、工具错误、重复动作和耗时。
3. Calibration：把监控信号映射到可信度与下一步门控。
4. Adaptation：继续、补证据、请求人工或切换策略。

## 练习

- 增加“来源新鲜度”和“权限可见性”两个注意力因子。
- 用历史评测数据校准 confidence，而不是手写固定惩罚。
- 将 `pivot` 连接到 s32 的另一种推理策略，并设置最大切换次数。

## 与生产的边界

本课用线性分数近似认知过程，不声称模拟人类意识。生产应把工作区选择、监控和适应做成可审计的 Harness
机制，并与预算、Trace、权限和取消统一。
