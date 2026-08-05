# s65：可恢复 Research Worker

## 本课目标

把 Deep Research 变成可恢复的 Worker：来源抓取有重试，成功来源立即
checkpoint，最终输出带引用和质量分数。

## 关键机制

- `SourceFetcher` 和 `CheckpointStore` 是外部依赖，便于测试、替换搜索供应商和恢复执行。
- 每个 URL 有独立重试上限，Abort 后不再继续隐藏工作。
- 输出保留 URL、标题、抓取时间和证据文本，不把“找到”冒充为“已验证”。

## 运行与练习

```sh
deno check stages/s65_research_worker_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s65_research_worker_runtime.ts
```

1. 并行抓取并限制并发数，加入指数退避。
2. 增加 citation validator、freshness 检查和 critic/synthesis Agent。
3. 杀掉进程后从 checkpoint 恢复，并测试重复 URL 不会重复计费。

## 生产边界

课程用假 Fetcher；生产需要真实搜索、robots/权限处理、持久化 checkpoint、引用质量评估和流式综合。
