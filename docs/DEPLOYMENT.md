# Deno Agent 部署与发布

本文说明如何开发、构建、发布和更新 Deno Agent 客户端。发布目标是一个可安装的本地 Agent
客户端；GitHub Release 提供客户端下载包，已安装客户端通过“设置 → 更新”完成下载、退出、替换和重启。

## 前提条件

- Deno 2.9 或更新版本。
- macOS 开发机。当前自动发布脚本主要构建 macOS arm64 客户端。
- Git 仓库已推送到 GitHub。
- GitHub Releases 可以被匿名访问；公开仓库可直接使用。

检查 Deno：

```sh
deno --version
```

## 本地开发

```sh
cd /Users/youjunmao/WORK/Learn_AI
deno task check
deno task desktop
```

HMR 开发：

```sh
deno task desktop:hmr
```

内部演进示例：

```sh
deno task s01
deno task s20
```

`stages/` 只用于理解内部机制和对照实现，不能被生产代码引用。

## 模型与密钥

开发时可以使用 `.env.local`：

```sh
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

发布构建不会读取或嵌入 `.env.local`。桌面应用中配置的 API Key 会在 macOS 上写入 Keychain。

## 构建

构建当前 macOS Apple Silicon 产物：

```sh
deno task desktop:build:mac-arm64
```

产物：

```text
dist/releases/macos-arm64/DenoAgent.app
```

构建全部目标：

```sh
deno task desktop:build:all
```

全部目标产物：

```text
dist/releases/
├── macos-arm64/DenoAgent.app
├── macos-x64/DenoAgent.app
├── windows-x64/DenoAgent.msi
├── linux-x64/DenoAgent.AppImage
└── linux-arm64/DenoAgent.AppImage
```

交叉构建只能验证编译和打包，不等于完成各系统运行验收。正式发布前需要在目标系统验证文件选择器、凭据存储、Shell、Git、WebView
和应用退出行为。

## 版本号规则

应用版本号在 `desktop/main.ts`：

```ts
const APP_VERSION = "1.0.1";
```

发布新版本时先修改它，例如：

```ts
const APP_VERSION = "1.0.2";
```

Release tag 必须和 `APP_VERSION` 匹配：

| APP_VERSION | 合法 tag            |
| ----------- | ------------------- |
| `1.0.2`     | `v1.0.2`            |
| `1.0.2`     | `deno-agent-v1.0.2` |

本地发布脚本会检查版本号，不匹配会拒绝发布。

## 本机 token 发布

这是当前最直接的发布方式，不依赖 GitHub Actions，也不受 GitHub Actions billing 状态影响。

### 1. 创建 GitHub Token

在 GitHub 创建 fine-grained Personal Access Token：

- Repository access：选择 `baiyangzuoshu/Learn_AI`
- Repository permissions：`Contents: Read and write`

不要把 token 提交到仓库。

### 2. 配置本机环境变量

临时配置：

```sh
export GITHUB_TOKEN=github_pat_xxx
```

或写入 shell 配置：

```sh
echo 'export GITHUB_TOKEN="github_pat_xxx"' >> ~/.zshrc
source ~/.zshrc
```

### 3. 提交源码

发布脚本要求源码改动已提交：

```sh
cd /Users/youjunmao/WORK/Learn_AI
git add .
git commit -m "Release Deno Agent v1.0.2"
git push origin main
```

### 4. 发布

```sh
cd /Users/youjunmao/WORK/Learn_AI
deno task release:github v1.0.2
```

脚本会自动执行：

```text
读取 APP_VERSION
  ↓
检查 tag 与版本号一致
  ↓
确认源码已提交
  ↓
deno fmt --check
  ↓
deno task check
  ↓
确认 src/ desktop/ 不引用 stages/
  ↓
deno task desktop:build:mac-arm64
  ↓
压缩 DenoAgent.app 为 zip
  ↓
创建或更新 GitHub Release
  ↓
上传 DenoAgent-vX.Y.Z-macos-arm64.zip
```

生成的 asset 名称示例：

```text
DenoAgent-v1.0.2-macos-arm64.zip
```

## GitHub Actions 发布

仓库根目录有 workflow：

```text
.github/workflows/release-deno-agent.yml
```

触发方式：

```sh
git tag v1.0.2
git push origin v1.0.2
```

或在 GitHub Actions 页面手动运行 `Release Deno Agent` workflow。

注意：

- Actions 需要仓库允许 `contents: write`。
- 如果 GitHub 账号 billing 或 spending limit 阻止 Actions，workflow 不会启动。
- workflow 同样会检查 tag 与 `APP_VERSION` 是否一致。

## 自动更新配置

默认更新源：

```text
https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

因为 App 内更新检查是匿名请求，所以 Release 必须公开可访问。如果仓库改回 private，GitHub
会对未授权请求返回 404，App 会显示更新失败。

可以在设置页或环境变量中覆盖更新源：

```sh
DENO_AGENT_UPDATE_URL=https://api.github.com/repos/baiyangzuoshu/Learn_AI/releases/latest
```

也支持自定义 manifest：

```json
{
  "version": "1.0.2",
  "url": "https://example.com/deno-agent/releases/1.0.2",
  "downloadUrl": "https://example.com/deno-agent/releases/DenoAgent-v1.0.2-macos-arm64.zip",
  "notes": "Release notes"
}
```

## 用户更新流程

用户在旧版本 App 中：

1. 打开“设置 → 更新”。
2. 点击“检查更新”。
3. 如果发现新版本，点击“下载并重启更新”。
4. App 下载 zip，退出当前进程。
5. 后台脚本替换 `.app`。
6. App 自动重新打开。

当前自动替换流程面向 macOS `.app` 包。Windows 和 Linux
产物可以构建，但自动安装替换需要后续分别实现平台策略。

## 发布前检查清单

- [ ] `APP_VERSION` 已更新。
- [ ] README 或 docs 中的示例版本已同步。
- [ ] `deno fmt --check` 通过。
- [ ] `deno task check` 通过。
- [ ] `rg 'stages/' src desktop` 无输出。
- [ ] `deno task desktop:build:mac-arm64` 通过。
- [ ] GitHub Release 是 public 可访问。
- [ ] Release asset 包含 `DenoAgent.app`。
- [ ] 用旧版本 App 实测“检查更新 → 下载并重启更新”。

## 常见问题

### 点击检查更新显示 404

通常是 Release API 不能匿名访问。确认仓库或 release-only 仓库是 public。

### 发布脚本提示缺少 GITHUB_TOKEN

先配置：

```sh
export GITHUB_TOKEN=github_pat_xxx
```

### 发布脚本提示版本不匹配

确认 `desktop/main.ts` 中的 `APP_VERSION` 与发布 tag 一致。

### GitHub Actions 没有启动

检查仓库 Actions 权限、账号 billing、spending limit，以及是否真的推送了 Git
tag，而不是只提交了一个名为 `tag vX.Y.Z` 的 commit。
