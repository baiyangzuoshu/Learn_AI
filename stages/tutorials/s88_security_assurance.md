# s88：Security Assurance

## 本课目标

从“有安全代码”升级到“有安全证据”：先建威胁模型，再运行负例和红队检查，最后将结果纳入发布门禁。

## 核心机制

- 威胁具有明确攻击面、控制和严重度。
- `runRedTeamChecks` 强制执行 Prompt Injection 和 Secret Exfiltration 负例。
- 任一关键控制失败都阻止发布。

## 练习

1. 增加 SSRF、路径逃逸、DLP、权限提升和恶意 MCP Server 测试。
2. 接入真实 IAM、JWT、Sandbox 和出口代理。
3. 保存审计证据和策略版本，支持事故回放。

## 生产边界

课程规则是最小模型；生产需要持续红队、依赖扫描、密钥轮换和人工安全复核。
