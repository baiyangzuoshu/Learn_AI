# s58：运行时安全强制执行

## 本课目标

将 s49 的安全概念放到每个执行边界：principal、tenant、scope、path、egress、payload 和 DLP。

## 核心符号

- `authorize`：返回允许/拒绝原因和审计字段。
- `resolveWorkspace`：规范化路径并阻止逃逸。
- `egressAllowed`：只允许 HTTPS、host allowlist 和大小上限。
- `redact`：在日志/模型输出前脱敏。

## 运行

```sh
deno check stages/s58_security_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s58_security_runtime.ts
```

## 练习

- 使用 Web Crypto 实现短期签名 token 验证。
- 加入 command allowlist、超时、资源限制和子进程回收。
- 构建 prompt injection/data exfiltration 负例集，接入 s55。

## 与生产的边界

教学代码没有替代操作系统沙箱、Secrets Manager、网络代理或企业 IAM。所有真实 mutating tool
都必须在执行时重新授权。
