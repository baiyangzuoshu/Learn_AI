# Deno Agent

用 Deno 逐层重建 `learn-claude-code` 的 Agent Harness，最终接入桌面界面。

## 路线

| 阶段 | 机制                      |
| ---- | ------------------------- |
| s01  | Agent loop + Bash         |
| s02  | 工具注册与文件工具        |
| s03  | 权限审批                  |
| s04  | Hooks                     |
| s05  | Todo                      |
| s06  | Subagent                  |
| s07  | Skill 按需加载            |
| s08  | 上下文压缩                |
| s09  | Memory                    |
| s10  | System prompt 组装        |
| s11  | 错误恢复                  |
| s12  | 持久化任务图              |
| s13  | 后台任务                  |
| s14  | Cron 调度                 |
| s15  | Agent teams               |
| s16  | 团队协议                  |
| s17  | 自治 Agent                |
| s18  | Git worktree 隔离         |
| s19  | MCP 插件                  |
| s20  | 完整 Harness + Desktop UI |

## 完整 Harness

安装 Deno 后运行：

```sh
deno task s20
```

s01–s20 已完整接入桌面版。可在开发者模式中观察 Hook、工具、团队、自治、Worktree 与 MCP 事件。

## 桌面版

```sh
../.deno/bin/deno task desktop
```

使用 Deno 2.9 原生 `deno desktop` 和系统 WebView，不依赖 Electron、Node 或 Rust。开发时可运行：

```sh
../.deno/bin/deno task desktop:hmr
```

生成 macOS 应用：

```sh
../.deno/bin/deno task desktop:build
```

发布构建不会读取或嵌入 `.env.local`。正式版密钥由设置界面写入 macOS Keychain。
