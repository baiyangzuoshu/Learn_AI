# 构建与验证记录

日期：2026-10-14。宿主：macOS ARM64。

| 检查                      | 结果                                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm test`                | 10 项通过，包含配对、授权、会话隔离、证书校验、输入边界及真实子进程取消/释放 |
| `test/main-smoke.cjs`     | 实际主进程、preload、renderer 的 HTTPS 上线/下线和清理通过                   |
| `test/webrtc-smoke.cjs`   | Chromium WebRTC 实际收到 320×180 合成视频和 DataChannel 输入消息             |
| macOS 原生组件            | Swift 编译通过；不向本机注入测试键鼠                                         |
| macOS 包                  | `releases/mac-arm64/LinkDesk.app`；ad-hoc 签名和严格校验通过，无 zip         |
| Windows 包                | x64 NSIS 安装包和 blockmap 生成；未做 Windows 原生运行测试，未做发行商签名   |
| 原型格式                  | Deno 格式检查通过                                                            |
| 仓库类型检查              | `(cd typescript && deno task check)` 通过                                    |
| 生产架构边界              | `rg 'stages/' typescript/src typescript/desktop` 无匹配                      |
| 原有 Agent Windows 构建   | x64 NSIS 构建通过，使用本地校验资源并跳过额外的签名/图标编辑工具             |
| 仓库全量格式              | 发现原有 CSS、AGENTS.md 和 README.md 格式问题，未格式化无关内容              |
| Graphify                  | 执行 `graphify update .` 更新代码图                                          |
| 真实 macOS ↔ Windows 互控 | 待按 TESTING.md 验收                                                         |

GitHub 下载不可达时，Windows Electron 从 npm 镜像取得，SHA-256 与固定版本官方
npm 包的 `checksums.json` 匹配。7zip 与仓库 NSIS 资源均按 Electron Builder
内置摘要校验。未关闭 TLS 校验或跳过文件摘要校验。

REA 完成的是 ToDesk 主程序的静态 Mach-O
检查，没有完成函数反编译、运行时协议分析或服务器代码恢复。详细证据边界见
`research/TODESK.md`。
