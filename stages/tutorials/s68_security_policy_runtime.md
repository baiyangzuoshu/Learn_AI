# s68：安全策略运行时

## 本课目标

把安全从“请求前检查”推进到执行时 Policy：身份、scope、过期时间、沙箱路径、出口 allowlist
和审计一起决定动作能否发生。

## 关键机制

- Principal 的 scope 和 expiry 每次动作都重新检查。
- 出口必须 HTTPS 且命中 allowlist，不能依赖模型自律。
- 所有允许和拒绝都记录 Audit Event，便于追责和红队复盘。

## 运行与练习

```sh
deno check stages/s68_security_policy_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s68_security_policy_runtime.ts
```

1. 将固定 token 替换为 JWT/JWKS 验证和密钥轮换。
2. 加入 SSRF、私网地址、DNS rebinding 和速率限制测试。
3. 把文件/命令执行放进 OS 或容器沙箱，并加入 DLP 规则。

## 生产边界

教学策略是最小模型；生产还需要 IAM、审计留存、策略版本、出口代理、密钥管理和红队测试。
