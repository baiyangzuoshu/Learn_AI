# s35：Production Acceptance and Migration

## 合并范围

整合 s81–s90 的生产迁移适配器、Gateway、Worker、红队和验收矩阵。

## 学习重点

能力不能因“有代码”就进入 `src/`。它需要公开契约、Feature
设计、集成测试、Trace、安全、回滚和文档；任何一项缺证据都阻断迁移。

## 练习

1. 将矩阵中的占位 `verified` 换为真实测试证据。
2. 为每项能力指定生产模块、负责人和回滚方案。
3. 故意制造失败，验证发布不可继续。

## 生产迁移

迁移后保持 `rg 'stages/' src desktop` 无匹配。
