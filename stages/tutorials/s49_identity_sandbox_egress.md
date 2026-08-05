# s49：Identity、Sandbox、Egress 与 DLP

## 本课目标

安全边界不能只靠
Prompt。每次工具调用都要重新验证身份、租户、角色、路径、网络目的地、请求大小和数据流。

## 代码地图

- `authorizeIdentity`：检查角色、租户和过期时间。
- `safeWorkspacePath`：阻止路径逃逸。
- `allowEgress`：使用 host、method、bytes allowlist。
- `detectInjection` / `redactData`：拦截常见注入并脱敏。

## 运行

```sh
deno check stages/s49_identity_sandbox_egress.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s49_identity_sandbox_egress.ts
```

## 练习

- 为 Agent、User、Service 分别建立身份和 token audience。
- 增加命令沙箱：允许列表、CPU/内存/时间限制和子进程清理。
- 建立“输入→模型→工具→输出”数据流标签，阻止秘密外泄。

## 与生产的边界

本课 ACL 和正则只是机制演示。生产需要操作系统沙箱、Secrets
Manager、网络策略、审计、限流、内容安全和红队测试。
