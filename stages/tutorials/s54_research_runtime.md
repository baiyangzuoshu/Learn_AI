# s54：可取消、可恢复的 Research Runtime

## 本课目标

把 Deep Research 从确定性循环推进到真实运行时：并行来源、AbortSignal、checkpoint、follow-up
questions 和质量停止。

## 核心符号

- `ResearchCheckpoint`：外置循环状态。
- `SourceFetcher`：把搜索/读取工具注入运行时。
- `Promise.allSettled`：允许部分来源失败。
- `run`：每轮限制问题数和最大迭代数，并响应取消。

## 运行

```sh
deno check stages/s54_research_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s54_research_runtime.ts
```

## 练习

- 为 source 结果增加 citation、时间、新鲜度和可信度。
- 对 transient error 做指数退避，对 permanent error 直接记录。
- 将 checkpoint 写入 s53 store，支持进程重启后 resume。

## 与生产的边界

本课 fetcher
是注入的教学函数。生产需要搜索服务、限流、来源验证、缓存、成本预算、取消传播和最终独立综合。
