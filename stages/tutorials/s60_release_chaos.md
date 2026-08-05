# s60：Release、SLO 与 Chaos Capstone

## 本课目标

完成从课程到生产迁移前的最后一道门：版本兼容、SLO、灰度指标、瞬时故障恢复和回滚证据。

## 核心符号

- `ReleaseManifest`：绑定 prompt、tools、model、schema 版本。
- `validateManifest`：阻止非法版本和 schema 回退。
- `evaluateSlo`：检查 success rate、p95 latency、cost。
- `chaos`：注入 transient failure 验证恢复路径。

## 运行

```sh
deno check stages/s60_release_chaos.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s60_release_chaos.ts
```

## 练习

1. 增加 canary 百分比和自动 rollback。
2. 注入 provider timeout、MCP 断线、queue 重复投递和 memory store 损坏。
3. 把 s55 回归、s58 安全负例、s57 health 和 s56 Trace 组合成 release gate。

## 与生产的边界

本课只验证控制逻辑，不会构建容器或发布版本。真正上线前还需原生平台测试、负载/混沌测试、事故手册和人工批准。
