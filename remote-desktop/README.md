# LinkDesk 远程桌面原型

独立于 AI Agent 的 macOS / Windows
远程桌面原型。首版提供设备配对、被控端确认、屏幕视频、键鼠控制和双方主动断开。采用
Electron 原生 HTML/CSS/JS、Node.js HTTPS 信令与 Chromium WebRTC；被控端使用
macOS CoreGraphics 或 Windows SendInput。

## 快速运行

需要 Node.js 22+。在本仓库中可复用已安装的
`typescript/electron/node_modules`；单独复制此目录后，在这里运行 `npm install`。

```sh
npm run certificate
npm run relay
```

另开终端启动客户端：

```sh
npm start
```

`certificate` 需要 OpenSSL；也可通过 `LINKDESK_CERT` 和 `LINKDESK_KEY`
指定已有证书。证书私钥位于被 Git 忽略的
`.local/`，不进入客户端构建。默认信令服务只监听 `127.0.0.1:9443`。

## 两台电脑连接

1. 在一台电脑运行信令服务。局域网测试显式设置 `LINKDESK_HOST` 为该机的局域网
   IP，允许端口 9443 的入站连接。它是独立的远程信令服务，客户端无本地 HTTP
   控制接口。
2. 两台客户端输入同一个 `https://局域网IP:9443`
   地址。使用本地自签名证书时，复制信令服务启动时显示的完整 SHA-256
   指纹；通过可信渠道核对。受信任的正式证书可留空。
3. 分别点击“上线”。控制端输入被控端的设备编号和临时密码，点击“连接设备”。
4. 被控端选择屏幕，确认是否允许键鼠控制，再点击“允许连接”。
5. 点击远程画面取得键盘焦点。任一端点击“断开连接”即可结束；全局快捷键为
   `Cmd/Ctrl + Shift + Esc`。

macOS：

```sh
LINKDESK_HOST=192.168.1.10 npm run relay
```

Windows PowerShell：

```powershell
$env:LINKDESK_HOST = '192.168.1.10'
npm.cmd run relay
```

macOS
被控需要在系统设置授予应用“屏幕与系统音频录制”中的屏幕录制权限，以及“辅助功能”权限。授权后可能需要重启应用。拒绝权限会阻止对应功能；系统权限由用户操作。

Windows 被控首版只共享主显示器，以避免混合 DPI 多屏坐标错误。键鼠组件由 Windows
PowerShell 5.1 加载本地脚本并编译内嵌
C#；执行策略或组织策略阻止脚本时，界面报告启动失败，不修改系统策略。普通进程无法控制更高完整性级别的窗口、UAC
安全桌面或发送 Ctrl+Alt+Del。

## 网络与范围

同一局域网可用主机 ICE 候选直连。跨 NAT 的公网连接需要自行部署 STUN /
TURN，并在两台客户端的连接设置填写 JSON，例如：

```json
[
  { "urls": "stun:stun.example.com:3478" },
  {
    "urls": "turns:turn.example.com:5349",
    "username": "temporary-user",
    "credential": "temporary-credential"
  }
]
```

信令服务只传输配对、授权和 SDP/ICE 消息。媒体及输入通过 WebRTC
的加密通道传输；使用 TURN 时经 TURN 中继。设备临时密码、服务凭证和 TURN
凭证不写入客户端持久化设置。信令 TLS
校验使用系统信任链，或用户指定的精确证书指纹；不会全局忽略证书错误。

首版为有人值守、单会话、基础物理键位控制。暂未实现账号、无人值守、系统服务、音频、文件传输、剪贴板、IME
文本输入、多屏切换或断线重连。不会连接 ToDesk 的服务器；独立实现自己的连接协议。

## 构建与验证

```sh
npm test
npm run build
npm run dist:mac
npm run dist:win
```

macOS 构建需要 Xcode Command Line Tools；Windows 构建保留其 PowerShell
组件。macOS 产物为 `releases/mac-arm64/LinkDesk.app`，Windows 为
`releases/LinkDesk Setup 0.1.0.exe`。macOS 打包使用 `dir`，不会生成
zip；当前为本地 ad-hoc 签名，没有 Developer ID 公证。

`test` 覆盖真实 HTTPS
客户端配对与信令、批准前拒绝、会话隔离、密码错误、重放、超时、限流、证书指纹以及输入与坐标边界。它需要
OpenSSL，并监听临时 loopback 端口。

`test/webrtc-smoke.cjs` 可用 Electron 运行，验证 Chromium
实际传输合成视频和输入数据，不采集真实屏幕或注入真实键鼠。跨编译与这些测试不能替代两台真实
macOS / Windows 设备的端到端验收。

REA 的检查结果与可验证事实见 [ToDesk 研究记录](research/TODESK.md)。

实际双机测试见 [验收步骤](TESTING.md)，已执行检查见
[验证记录](VERIFICATION.md)。
