# ToDesk 静态研究记录

检查日期：2026-10-14。工具：官方 npm 包 `rea-agents@6.4.0`，通过临时 npm
缓存运行 CLI；未修改 Codex 的全局 MCP 注册。

目标为本机 `/Applications/ToDesk.app`，Info.plist 声明版本 `5.1.0.0`、构建
`2712`。REA 对主程序执行 `inspect-macho` 后成功生成规范 Evidence：

- Evidence
  ID：`ev_0e7d5a848f9e16ac52399d44c7a23c2fb0adb89218f6ca193e3e90fdddf771f7`
- 目标
  SHA-256：`5c4f6dfc97a52fd85cf937461c51328dab652f61170783edf6fd7bd9e5f3ac3f`
- 提供者：`native-macos` / macOS native inspection utilities。
- 目标类型：64 位 ARM64 Mach-O，可执行文件。
- 构建元数据声明最低 macOS 11.0、SDK 26.2。
- Load Commands 包含
  ScreenCaptureKit、Metal/MetalKit、CoreVideo、CoreAudio、AVFoundation、Cocoa
  等系统框架。
- 导入符号中可观察到
  `CGEventCreateKeyboardEvent`、`CGEventCreateMouseEvent`、`CGEventPost`、`SCStream`
  和 `SCStreamConfiguration`。符号清单报告
  `exhaustive: false`，不能用未出现的符号证明某项能力不存在，也不能用出现的符号证明它在一次具体会话中被调用。

应用 Frameworks 目录可观察到
`zrtc.framework`、`zagent.framework`、`zulerLog.framework`、`Sparkle.framework`
和
`Breakpad.framework`。框架名称及系统依赖仅证明打包和链接关系，不能证明实际启用的编解码器、连接协议、加密方案、运行时路径或服务器架构。

完整 Evidence 保存在被 Git 忽略的 `research/evidence/todesk-macho.json`。初次
`inspect-artifact` 遍历应用包时遇到 `Contents/mmkv.default` 的
EACCES，因此未完成完整应用包清单；后续改为检查明确的主程序文件，没有提升权限读取该数据文件。

复现：

```sh
npm --registry https://registry.npmjs.org --cache /private/tmp/rea-todesk-npm-cache exec --yes --package=rea-agents@6.4.0 -- rea inspect-macho '/Applications/ToDesk.app/Contents/MacOS/ToDesk' --format json
```

本机没有发现 Hopper、Ghidra 或 IDA，因此未开展函数反编译。没有启动 ToDesk
的运行时捕获、读取账号凭证或获取其服务器代码。

LinkDesk 的实现选择是独立设计：Electron 捕获选中屏幕，WebRTC 传输，HTTPS
服务协商，CoreGraphics / SendInput
注入已批准的输入。该方案由首版需求与可用平台接口确定，不是对 ToDesk
内部实现的断言。

资料：[REA](https://github.com/morluto/rea)、[ToDesk 官方功能](https://www.todesk.com/)、[Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)、[Windows SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)。
