# s78：IAM、Sandbox、Egress 与 DLP

## 本课目标

把安全判断放在模型之外：身份 scope、过期时间、路径沙箱、出口 allowlist、私网阻断和 DLP
一起决定动作。

## 核心机制

- 每次动作重新验证短期 Identity。
- `path` 阻止工作区逃逸，`egress` 阻止非 HTTPS 和私网目标。
- DLP 在输出或外部发送前检测密钥、密码和 API Key 模式。

## 练习

1. 接入 JWT/JWKS、密钥轮换、Agent-to-Agent 身份。
2. 测试 SSRF、DNS rebinding、路径编码和 Prompt Injection。
3. 增加限流、策略版本、审计留存和 OS/容器沙箱。

## 生产边界

课程使用注入式策略；生产需要真正 IAM、出口代理、沙箱和红队验证。
