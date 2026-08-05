# s90：Production Acceptance

## 本课目标

把 81–89 的能力收敛成最后的迁移条件：任何一个关键证据缺失，都不能宣称生产就绪。

## 关键设计

`standardChecks` 覆盖
Runtime、Schema/Trace、MCP、A2A、Memory、Evaluation、Worker、安全、认知和发布回滚。`productionAcceptance`
返回失败项及其证据，适合交给 CI 或人工审批。

## 练习

1. 用真实集成测试替换每个 `verified` 占位证据。
2. 关联版本号、构建产物、评估数据集和发布审批人。
3. 故意让一项检查失败，验证 promotion 会被阻断。

## 生产边界

这不是自动上线按钮。跨平台原生测试、凭据存储、WebView、网络、Git、关闭流程和人工责任仍需在真实环境完成。
