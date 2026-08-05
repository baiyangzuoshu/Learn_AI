# s31：Identity, Sandbox, Egress, and DLP

## 合并范围

整合 Permission、Security Runtime、Identity、Sandbox、Egress、DLP、Policy 和安全治理。

## 学习重点

安全在执行时强制：身份有 scope 与过期时间；路径不能逃逸 workspace；出口必须 HTTPS 且
allowlisted；敏感内容必须在日志和外发前脱敏。

## 练习

1. 接入 JWT/JWKS 与 Agent-to-Agent 身份。
2. 增加 SSRF、DNS rebinding、路径编码和 prompt injection 测试。
3. 设计策略版本、豁免期限和审计留存。

## 生产迁移

规则不是沙箱替代品；还需容器/OS 隔离、出口代理、密钥管理和人工审批。
