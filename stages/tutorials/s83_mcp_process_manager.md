# s83：MCP Process Manager

## 本课目标

管理真实 MCP 子进程的启动、初始化、复用、取消、重启和关闭。

## 核心机制

- `McpProcessFactory` 隔离 Deno child process 与协议 Session。
- 一个服务器 ID 对应一个可复用 Session。
- `shutdown` 关闭所有活动进程，避免取消后留下后台工作。

## 练习

1. 用 `Deno.Command` 将 stdin/stdout 接入 `McpTransportSession`。
2. 加入启动超时、重启上限、stderr 截断和健康检查。
3. 测试客户端取消、Server 崩溃和协议版本不兼容。

## 生产边界

课程使用注入式进程；生产还需要本地路径校验、HTTPS 远端限制、权限审批和审计。
