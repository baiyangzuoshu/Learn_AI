# s11：错误恢复

源码：[s11_error_recovery.ts](../s11_error_recovery.ts)

## 学习目标

- 区分可重试与不可重试错误。
- 掌握指数退避、服务端 `retry-after` 和取消信号。
- 避免把工具业务错误当作网络错误重试。

## 核心机制

Provider 对超时、限流和服务端错误执行有限重试，并发出 `ErrorRecovery`
Hook。认证失败、参数错误等确定性问题立即返回。退避等待必须响应 `AbortSignal`。

## 运行与观察

```sh
deno task s11
```

使用错误地址或模拟限流，观察重试次数和等待时间，随后取消请求确认等待能够中止。

## 练习

加入随机抖动和按 Provider 统计的熔断状态。
