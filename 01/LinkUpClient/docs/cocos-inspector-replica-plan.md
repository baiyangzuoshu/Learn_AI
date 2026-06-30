# CocosInspector 复刻计划书

> **版本**: 1.0  
> **原始插件**: Cocos Runtime Inspector v2.2.1 (by chuan.zhang)  
> **目标**: 从零复刻一个功能一致的 Cocos Creator 编辑器插件，代码可读、可扩展，为后续功能迭代做准备。

---

## 目录

1. [概述](#1-概述)
2. [架构总览](#2-架构总览)
3. [文件清单与规格](#3-文件清单与规格)
4. [IPC 协议规范](#4-ipc-协议规范)
5. [UI 规范](#5-ui-规范)
6. [全局 API 规范（Preload 注入）](#6-全局-api-规范preload-注入)
7. [场景脚本规范](#7-场景脚本规范)
8. [实现阶段](#8-实现阶段)
9. [验收标准](#9-验收标准)

---

## 1. 概述

### 1.1 这是什么

CocosInspector 是一个 **Cocos Creator 编辑器扩展包**（package），在编辑器中嵌入一个独立窗口，用于：

- 实时预览游戏运行画面（内嵌 webview）
- 检查运行时的场景节点树
- 实时查看和修改组件属性
- 捕获游戏日志
- 调试辅助（FPS、静音、暂停、设计模式、悬停定位）
- 分辨率切换
- 支持 HTTP 代理
- 支持 Prefab 运行时修改回写

### 1.2 目标输出

| 项目 | 说明 |
|------|------|
| **代码风格** | TypeScript（主进程 + 渲染进程），清晰可读，无混淆 |
| **UI 框架** | Vue 3（渲染进程） |
| **构建工具** | Vite 或直接运行（Cocos Creator 扩展机制） |
| **兼容性** | Cocos Creator 2.x / 3.x 编辑器（Electron 环境） |
| **扩展能力** | 模块化设计，预留插件扩展接口 |

---

## 2. 架构总览

### 2.1 进程模型

```
┌──────────────────────────────────────────────────────────┐
│                    Cocos Creator Editor                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Main Process (main.js)                    │ │
│  │  - 创建 BrowserWindow（Inspector UI 窗口）              │ │
│  │  - 系统托盘 + 右键菜单                                  │ │
│  │  - IPC 监听（与 renderer / webview / scene-script 通信） │ │
│  │  - 配置读写 (config.json)                              │ │
│  │  - HTTP 自定义请求头注入                                 │ │
│  │  - 编辑器 API 调用（打开资源管理/TS 文件/定位节点等）      │ │
│  └───────────┬──────────────────┬──────────────────────┘ │
│              │ IPC              │ IPC                     │
│  ┌───────────▼────────┐ ┌──────▼───────────────────────┐ │
│  │  Renderer Process   │ │   Game Webview               │ │
│  │  (index.html+app.js)│ │   (游戏运行页面)               │ │
│  │                     │ │                              │ │
│  │  Inspector UI:      │ │   preload.js → 注入全局 API   │ │
│  │  - 游戏预览区        │ │   scene-script.js → 场景操作  │ │
│  │  - 节点树面板        │ │                              │ │
│  │  - 属性检查面板      │ │                              │ │
│  │  - 控制台面板        │ │                              │ │
│  │  - 设置面板          │ │                              │ │
│  └─────────────────────┘ └──────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │       Scene Script (scene-script.js)                  │ │
│  │  - 注入到游戏场景中运行                                  │ │
│  │  - 提供节点树序列化、属性读/写、节点定位、Prefab 保存等    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.2 通信流程

```
UI 交互 → Renderer → IPC → Main Process → 编辑器 API / webview executeJavaScript
                                          → webview.preload 全局函数
游戏数据 → preload 全局函数 → IPC → Main Process → IPC → Renderer → UI 更新
场景操作 → Renderer → IPC → Main → webview executeJavaScript → scene-script → cc.engine
```

---

## 3. 文件清单与规格

```
packages/CocosInspector/
├── package.json              # Cocos Creator 扩展清单
├── config.json               # 默认配置
├── plugins.json              # 右键菜单插件配置
│
├── main.js                   # 【主进程入口】Electron 主进程逻辑
├── mainPreload.js            # 【主进程 preload】在 BrowserWindow 创建前执行的脚本
│
├── index.html                # 【渲染进程】Inspector UI 入口
├── app.js                    # 【渲染进程】Vue 3 应用主逻辑
│
├── preload.js                # 【webview preload】注入到游戏 webview
├── dwPreload.js              # 【DevTools webview preload】注入到 DevTools webview
│
├── scene-script.js           # 【场景脚本】注入到游戏场景
│
├── dark.css                  # 暗色主题
├── light.css                 # 亮色主题
├── iconfont.css              # 图标字体定义
├── iconfont.ttf/woff/woff2   # 图标字体文件
│
├── aa.js                     # 低版本兼容（可忽略）
├── aa_low_version.js         # 低版本兼容（可忽略）
├── app_low_electron.js       # 低版本 Electron 兼容（可忽略）
├── index_low_electron.html   # 低版本 Electron 兼容（可忽略）
│
├── tj.js                     # 百度统计埋点（可忽略/替换）
├── vue.min.js                # Vue 运行时（改为 Vue 3 npm 包）
├── AestheticFluidBg.min.js   # 流体背景动画（可选保留）
│
└── assets/                   # 图标资源
    ├── icon.png              # 插件图标
    ├── tray.png              # 托盘图标
    ├── save.png              # 保存
    ├── refresh.png           # 刷新
    ├── delete.png            # 删除
    ├── locate.png            # 定位
    ├── search.png            # 搜索（亮色）
    ├── search_dark.png       # 搜索（暗色）
    ├── sort.png              # 排序
    ├── code.png              # 代码
    ├── component.png         # 组件
    ├── thunder.png           # 闪电
    └── wechatOC.jpeg         # 微信公众号二维码
```

---

## 4. 各文件详细规格

### 4.1 `package.json`

Cocos Creator 扩展清单文件：

```json
{
  "name": "cocos_inspector",
  "version": "3.0.0",
  "description": "Cocos Runtime Inspector - Replica",
  "author": "your-name",
  "main": "main.js",
  "scene-script": "scene-script.js",
  "main-menu": {
    "Cocos Inspector/Preview Mode": {
      "message": "cocos_inspector:previewMode",
      "accelerator": "Shift+Enter"
    },
    "Cocos Inspector/Build Mode": {
      "message": "cocos_inspector:buildMode"
    },
    "Cocos Inspector/Open Custom Page": {
      "message": "cocos_inspector:openCustomPage"
    },
    "Cocos Inspector/Refresh": {
      "message": "cocos_inspector:refresh"
    }
  }
}
```

### 4.2 `config.json`

默认用户配置：

```json
{
  "logCount": 3,
  "retinaEnable": true,
  "autoUpdateTree": true,
  "size": [320, 480],
  "isPortrait": true,
  "show": true
}
```

**完整配置项清单**（运行时存储在 Editor 的 profile 中，同时支持文件配置）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `logCount` | number | 3 | 游戏视图下方显示的日志条数 |
| `retinaEnable` | boolean | true | 视网膜显示模式 |
| `autoUpdateTree` | boolean | true | 自动刷新节点树 |
| `size` | [number, number] | [320,480] | 预览窗口尺寸（宽/高） |
| `isPortrait` | boolean | true | 是否竖屏 |
| `show` | boolean | true | 设置面板是否可见（内部状态） |
| `theme` | 'dark'\|'light' | 'dark' | 主题 |
| `useChinese` | boolean | true | 中文界面 |
| `propertyAlignLeft` | boolean | false | 属性名左对齐 |
| `openArrayLimit` | number | 10 | 自动展开数组长度阈值 |
| `prefabFontSize` | number | 1 | Prefab 节点文字尺寸 |
| `urlParams` | string | '' | URL 附加参数 |
| `customUrl` | string | '' | 自定义 URL |
| `spaceToPause` | boolean | false | 空格键暂停/恢复 |
| `syncNodeDetail` | boolean | false | 自动同步选中节点属性变化 |
| `showZ` | boolean | false | 显示节点 Z 属性 |
| `sliderWithInput` | boolean | false | 滑块显示输入框 |
| `openHttpProxy` | boolean | false | 开启 HTTP 代理 |
| `httpProxyServer` | string | '' | 代理服务器地址 |
| `proxyBypassRules` | string | '' | 代理排除规则 |
| `disableWebSec` | boolean | false | 禁用 Web 安全（需重启） |
| `showDevToolInTab` | boolean | false | 标签栏中显示 DevTools（需重启） |
| `displayAsFairyTree` | boolean | false | FairyGUI 节点树模式 |
| `hideFairyComContainer` | boolean | false | 隐藏 FGUI 组件 Container 层级 |

### 4.3 `main.js` — 主进程

**职责**：所有与编辑器底层交互的逻辑。

#### 4.3.1 导入依赖

```js
const { Tray, BrowserWindow, nativeImage, shell, dialog, app, remote, 
        ipcMain, session, Menu, MenuItem, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
```

#### 4.3.2 状态变量

```js
let win = null;          // BrowserWindow 实例
let tray = null;         // 系统托盘
let mode = 0;            // 0=Preview, 1=Build, 2=Custom
let unloaded = false;    // 是否已卸载
let userInfo = null;     // Cocos Store 用户信息
let customHeaders = {};  // 自定义 HTTP 请求头
let lastErrors = [];     // 最近错误列表
```

#### 4.3.3 核心方法

| 方法 | 触发方式 | 功能 |
|------|----------|------|
| `load()` | 插件加载时 | 注册所有 IPC 监听器 |
| `unload()` | 插件卸载时 | 移除所有 IPC 监听器，清理资源 |
| `readConfig()` | 内部调用 | 从文件读取配置 |
| `saveConfig(config)` | 内部调用 | 保存配置到文件 |
| `changeDWH()` | 配置变更时 | 更新窗口尺寸 (dw/dh) |
| `showWindow()` | 菜单/快捷键 | 创建并显示 Inspector 窗口 |
| `tryShowWindow(mode)` | 切换模式时 | 根据模式切换窗口 |
| `saveError(event, error)` | IPC | 记录错误 |
| `prompt(event, title, defaultValue)` | IPC | 弹出输入对话框 |
| `savePrefab(event, changes)` | IPC | 保存 Prefab 修改 |
| `openAssetManager()` | IPC | 打开 Cocos Store 资源管理器 |
| `openTS(event, fileId)` | IPC | 打开 TypeScript 源文件 |
| `focusNode(event, nodeId)` | IPC | 在编辑器中定位节点 |
| `focusAsset(event, assetId)` | IPC | 在编辑器中定位资源 |
| `updateConfig(event, newConfig)` | IPC | 更新配置 |
| `registerHeaderUrls(event, urls)` | IPC | 注册自定义 Header 的 URL 模式 |
| `setHeader(event, url, headers)` | IPC | 设置自定义 HTTP 请求头 |

#### 4.3.4 IPC 通道（消息名）

详见[第 5 节 IPC 协议规范](#5-ipc-协议规范)。

#### 4.3.5 系统托盘菜单

```
├── Copy Last Error    → 复制最后一个错误到剪贴板
├── Open DevTools      → 打开 Inspector 窗口的 DevTools（仅开发模式）
└── separator
```

#### 4.3.6 运行模式

| 模式 | mode 值 | 说明 |
|------|---------|------|
| Preview | 0 | 竖屏 320×480，标准预览模式 |
| Build | 1 | 构建模式 |
| Custom Page | 2 | 打开 setting.customUrl 指定的页面 |

#### 4.3.7 窗口配置

```js
const windowOptions = {
  width: dw,            // 从配置读取
  height: dh,           // 从配置读取
  title: `Cocos Inspector v${version}`,
  backgroundColor: '#2e2c29',
  webPreferences: {
    nodeIntegration: true,
    enableRemoteModule: true,
    sandbox: false,
    devTools: isDev,
    contextIsolation: false,
    webSecurity: !disableWebSec,
    resizable: !config.isPortrait,
    minimizable: !config.isPortrait,
    maximizable: !config.isPortrait,
    preload: path.join(__dirname, 'mainPreload.js')
  }
};
```

#### 4.3.8 URL 构建逻辑

游戏 webview 加载的 URL 格式：

```
file://<编辑器路径>/static/game.html?port=<端口>&mode=<模式>
```

附加参数包括用户信息（cocos_uid, nickname, access_token, ccc_version）等。

### 4.4 `mainPreload.js` — 主窗口 Preload

**职责**：在 Inspector UI 窗口的 `webview` 创建前执行，暴露全局配置读写方法。

暴露的全局函数：

```js
// 读取配置，返回配置对象
global.readConfig = () => { ... }

// 保存配置
global.saveConfig = (config) => { ... }
```

配置存储路径优先级：
1. `__parentConfig` = `<项目根>/cocos-inspector-config.json`（项目级配置）
2. `_configPath` = `<插件目录>/config.json`（默认配置）

### 4.5 `index.html` + `app.js` — 渲染进程 UI

**职责**：完整的 Inspector 前端界面。

#### 4.5.1 布局结构

```
┌──────────────────────────────────────────────────────────┐
│ #app (display: flex, row)                                │
│ ┌───────────────────────┬──────────────────────────────┐ │
│ │ .gamePanel            │ .nodePanel                   │ │
│ │ ┌───────────────────┐ │ ┌──────────────────────────┐ │ │
│ │ │ .gamebtns 工具栏   │ │ │ .tab 标签栏               │ │ │
│ │ │ [刷新][暂停][FPS]  │ │ │ [场景树][Console][Cocos]  │ │ │
│ │ │ [静音][悬停][设计]  │ │ │ [扩展] [帮助][设置]       │ │ │
│ │ │ [分辨率][DevTools] │ │ └──────────────────────────┘ │ │
│ │ ├───────────────────┤ │ ┌──────────────────────────┐ │ │
│ │ │ resolution-resizer│ │ │ 节点树 + 属性面板          │ │ │
│ │ │ resolution-select │ │ │ (v-show="tab==0")        │ │ │
│ │ ├───────────────────┤ │ ├──────────────────────────┤ │ │
│ │ │ <webview> 游戏画面 │ │ │ DevTools webview          │ │ │
│ │ ├───────────────────┤ │ │ (v-show="tab==1" &&       │ │ │
│ │ │ .logs 日志区域     │ │ │  showDevToolInTab)       │ │ │
│ │ └───────────────────┘ │ ├──────────────────────────┤ │ │
│ │                       │ │ Console Panel (tab==1)    │ │ │
│ │                       │ │ Cocos Panel (tab==2)      │ │ │
│ │                       │ │ Extension Panel (tab==3)  │ │ │
│ │                       │ └──────────────────────────┘ │ │
│ └───────────────────────┴──────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ .settingBox (绝对定位覆盖层)                            │ │
│ │ 设置面板：主题/语言/日志数量/代理/FairyGUI/关于等       │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ <my-help> 帮助面板（弹窗）                              │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ <validate-panel> 验证面板                              │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### 4.5.2 Vue 组件树

```
App (root)
├── ValidatePanel           # 订单号验证面板
├── .gamePanel              # 游戏预览区
│   ├── .gamebtns           # 工具栏
│   │   ├── 刷新按钮
│   │   ├── 暂停/恢复按钮
│   │   ├── FPS 开关按钮
│   │   ├── 静音按钮
│   │   ├── 悬停定位按钮
│   │   ├── 设计模式按钮
│   │   ├── 分辨率按钮
│   │   └── DevTools 按钮
│   ├── ResolutionResizer   # 分辨率调节器
│   ├── ResolutionSelector  # 分辨率选择下拉
│   ├── <webview>           # 游戏画面
│   └── .logs               # 日志列表
├── .nodePanel              # 检查面板
│   ├── .tab                # 标签栏
│   │   ├── Tab 0: 场景树 (带刷新按钮)
│   │   ├── Tab 1: Console / DevTools
│   │   ├── Tab 2: Cocos 信息
│   │   └── Tab 3: 扩展
│   ├── Panel: 节点树
│   │   ├── NodeView (递归组件)
│   │   ├── NodeDetailView  # 节点属性
│   │   ├── NodeComponent (组件列表, 递归)
│   │   └── SearchPanel     # 搜索面板
│   ├── Panel: DevTools webview 或 ConsolePanel
│   ├── Panel: CocosPanel
│   └── Panel: ExtensionPanel
├── .settingBox             # 设置面板（覆盖层）
│   ├── 语言切换
│   ├── 主题切换
│   ├── 日志数量
│   ├── 属性对齐
│   ├── Prefab 字体大小
│   ├── URL 参数
│   ├── 自定义 URL
│   ├── 视网膜模式
│   ├── 空格暂停
│   ├── 自动刷新节点树
│   ├── 同步属性变化
│   ├── 显示 Z 属性
│   ├── 滑块输入框
│   ├── HTTP 代理开关
│   ├── 代理服务器
│   ├── 排除规则
│   ├── 禁用 Web 安全（需重启）
│   ├── Tab 中显示 DevTools（需重启）
│   ├── FGUI 设置
│   │   ├── Fairy 节点树模式
│   │   └── 隐藏 FGUI 组件容器
│   └── 关于（作者/联系方式/网站/公众号）
└── MyHelp                   # 帮助面板
```

#### 4.5.3 主要数据属性（Vue data）

```js
{
  // 模式
  mode: 0,                 // 0=Preview, 1=Build, 2=Custom
  tab: 0,                  // 当前 tab

  // 游戏相关
  gameUrl: '',             // 游戏 webview URL
  paused: false,           // 是否暂停
  showFps: false,          // 是否显示 FPS
  isMuted: false,          // 是否静音
  hoverMode: false,        // 悬停定位模式
  designMode: false,       // 设计模式
  showResolutionSelector: false,

  // 节点树
  nodeTree: null,          // 当前场景节点树
  selectedNode: null,      // 选中节点 ID
  nodeDetail: null,        // 选中节点详情
  expandNodeSet: new Set(),// 展开的节点集合

  // 日志
  logs: [],                // 日志列表
  autoUpdateTree: true,

  // 设置
  setting: { ... },        // 从 config.json 加载 + localStorage

  // 其他
  sceneName: '',           // 场景名
  appLoaded: false,
}
```

#### 4.5.4 核心方法

**游戏控制**：

| 方法 | 功能 |
|------|------|
| `refresh()` | 刷新游戏 webview |
| `playOrPause()` | 暂停/恢复游戏 |
| `toggleFps()` | 切换 FPS 显示 |
| `toggleSnd()` | 静音/恢复 |
| `toggleHover()` | 悬停定位模式 |
| `toggleDesignMode()` | 设计模式（可拖拽节点） |
| `openWvDevTool()` | 打开游戏页面的 DevTools |

**节点操作**：

| 方法 | 功能 |
|------|------|
| `forceUpdateTree()` | 强制刷新节点树 |
| `selectNode(id)` | 选中节点 |
| `locateNode(ids)` | 在场景中定位节点 |
| `toggleNode(id)` | 展开/折叠节点 |
| `overNode(id, path)` | 鼠标悬停高亮节点 |
| `outNode()` | 取消悬停高亮 |
| `syncOpen(id, open, recursive)` | 同步节点展开状态 |
| `syncOpenFcom(id)` | 展开组件面板 |

**日志**：

| 方法 | 功能 |
|------|------|
| `pushLog(time, type, data)` | 添加日志 |
| `pushNormalLog(data)` | 添加普通日志 |
| `pushWarnLog(data)` | 添加警告日志 |
| `logColor(type)` | 日志颜色映射 |

#### 4.5.5 计算属性

| 属性 | 说明 |
|------|------|
| `gameUrl` | 根据 customUrl / urlParams / mode 构造的游戏 URL |
| `pauseIcon` | 暂停/播放图标 class |
| `showRefreshTreeBtn` | 是否显示刷新节点树按钮 |
| `sceneName` | 当前场景名称 |
| `smallLogs` | 裁剪后的日志（按 logCount） |

#### 4.5.6 生命周期

```
created()
  ├── 解析 URL query 参数（mode, port 等）
  ├── 加载 localStorage 配置
  ├── $nextTick → 设置窗口标题
  └── requestAnimationFrame → everyFrame()

beforeDestroy()
  └── 关闭 DevTools webview（如有）
```

### 4.6 `preload.js` — 游戏 Webview Preload

**职责**：在游戏 webview 中注入全局函数，作为游戏页面与 Inspector 之间的通信桥接。

#### 暴露的全局函数

```js
// 发送日志
global.sendLog = (msg) => ipcRenderer.send('cocos_inspector:sendLog', msg);
global.sendWarn = (msg) => ipcRenderer.send('cocos_inspector:sendWarn', msg);
global.sendError = (msg) => ipcRenderer.send('cocos_inspector:sendError', msg);

// 发送节点树（同步，返回结果）
global.sendTree = () => ipcRenderer.sendSync('cocos_inspector:sendTree');

// 游戏状态
global.sendGameState3G = () => ipcRenderer.send('cocos_inspector:gameState3G');

// 网络模拟
global.switchSlow3G = () => ipcRenderer.send('cocos_inspector:switchSlow3G');
global.switchFast3G = () => ipcRenderer.send('cocos_inspector:switchFast3G');
global.switchOffline = () => ipcRenderer.send('cocos_inspector:switchOffline');

// 节点操作
global.locateNode = (ids) => ipcRenderer.send('cocos_inspector:locateNode', ids);
global.showNodeDetail = (data) => ipcRenderer.send('cocos_inspector:showNodeDetail', data);

// 控制台
global.consoleLog = (msg) => ipcRenderer.send('cocos_inspector:consoleLog', msg);
global.consoleWarn = (msg) => ipcRenderer.send('cocos_inspector:consoleWarn', msg);
global.consoleError = (msg) => ipcRenderer.send('cocos_inspector:consoleError', msg);

// 提示对话框（同步，返回用户输入）
global.prompt = (title, defaultValue) => 
  ipcRenderer.sendSync('cocos_inspector:prompt', title, defaultValue);

// 更新节点树（由 scene-script 定时调用）
global.updateTree = (treeData) => ipcRenderer.send('cocos_inspector:updateTree', treeData);
```

### 4.7 `dwPreload.js` — DevTools Webview Preload

**职责**：加载 Chrome DevTools SDK，用于在 Tab 中嵌入 DevTools 面板。

逻辑：
1. 尝试 `import('devtools://devtools/bundled/devtools-frontend/front_end/entrypoints/inspector_main/inspector_main.js')`
2. 若失败则尝试 `import('devtools://devtools/bundled/sdk/sdk.js')`
3. 创建 `DevToolsAPI` 实例并初始化

### 4.8 `scene-script.js` — 场景脚本

**职责**：在游戏场景的 JavaScript 上下文中运行，直接访问 `cc` 引擎 API，提供节点树序列化、属性读写、节点定位等功能。

#### 核心功能

**1. 保存 Prefab 修改**

```js
'save-prefab-from-changes': (reply, changes) => { ... }
```

流程：
- 获取 `changes` 中第一个 nodeId 对应的场景节点
- 调用 `Editor.Scene.callSceneScript('save-prefab', ...)` 保存 Prefab
- 对于 `changes` 的其余键值，调用 `__syncNode` / `__setComAttr` 同步属性

**2. 同步节点属性**

```js
function syncNodeByFileId(nodes, changes) { ... }
```
- 递归遍历节点树，根据 fileId 匹配节点
- 应用 `changes` 中的属性变更
- 对于 `components` 字段，遍历并设置组件属性

**3. 内部辅助函数**

```js
// 同步节点属性（兼容引擎版本差异：scale→scale, color→Color, angle→Number）
var __syncNode = (node, key, value) => { ... }

// 设置组件属性
var __setComAttr = (comp, key, value) => { ... }
```

---

## 5. IPC 协议规范

### 5.1 通道命名规则

所有通道名以 `cocos_inspector:` 为前缀。

### 5.2 主进程 ↔ 渲染进程

| 通道 | 方向 | 触发方 | 参数 | 说明 |
|------|------|--------|------|------|
| `cocos_inspector:saveError` | R→M | renderer | `error: string` | 持久化错误信息 |
| `cocos_inspector:prompt` | R→M | renderer | `title: string, defaultValue: string` | 弹出输入对话框 (sync) |
| `cocos_inspector:savePrefab` | R→M | renderer | `changes: object` | 保存 Prefab 修改 |
| `cocos_inspector:openAssetManager` | R→M | renderer | — | 打开资源管理器 |
| `cocos_inspector:openTS` | R→M | renderer | `fileId: string` | 打开 TS 文件 |
| `cocos_inspector:focusNode` | R→M | renderer | `nodeId: string` | 在编辑器中定位节点 |
| `cocos_inspector:focusAsset` | R→M | renderer | `assetId: string` | 在编辑器中定位资源 |
| `cocos_inspector:updateConfig` | R→M | renderer | `config: object` | 同步配置到主进程 |
| `cocos_inspector:registerHeaderUrls` | R→M | renderer | `urls: string[]` | 注册 HTTP header 注入 URL |
| `cocos_inspector:setHeader` | R→M | renderer | `url: string, headers: object` | 设置自定义 HTTP 头 |
| `cocos_inspector:confirmValue` | R→M | renderer | `value: any` | prompt 返回值 |
| `cocos_inspector:confirmValue-return` | M→R | main | `value: any` | prompt 返回值（回传） |

### 5.3 Webview (游戏页面) → 主进程

| 通道 | 参数 | 说明 |
|------|------|------|
| `cocos_inspector:sendLog` | `msg: string` | 发送普通日志 |
| `cocos_inspector:sendWarn` | `msg: string` | 发送警告日志 |
| `cocos_inspector:sendError` | `msg: string` | 发送错误日志 |
| `cocos_inspector:sendTree` | — | 请求发送节点树 (sync) |
| `cocos_inspector:gameState3G` | — | 游戏状态 |
| `cocos_inspector:switchSlow3G` | — | 模拟慢速 3G |
| `cocos_inspector:switchFast3G` | — | 恢复快速网络 |
| `cocos_inspector:switchOffline` | — | 模拟离线 |
| `cocos_inspector:locateNode` | `ids: string[]` | 定位节点 |
| `cocos_inspector:showNodeDetail` | `data: object` | 显示节点详情 |
| `cocos_inspector:consoleLog` | `msg: string` | 控制台日志 |
| `cocos_inspector:consoleWarn` | `msg: string` | 控制台警告 |
| `cocos_inspector:consoleError` | `msg: string` | 控制台错误 |
| `cocos_inspector:prompt` | `title: string, defaultValue: string` | 弹出对话框 (sync) |
| `cocos_inspector:updateTree` | `tree: object` | 更新节点树数据 |

### 5.4 主进程 → Webview (执行 JavaScript)

主进程通过 `webview.executeJavaScript()` 在游戏页面中执行代码：

```js
// 示例：设置悬停模式
wv.executeJavaScript(`__setHoverMode(${enabled})`);

// 示例：请求节点详情
wv.executeJavaScript(`__getNodeDetail('${nodeId}')`);

// 示例：请求编译
wv.executeJavaScript(`__reCompile()`);
```

### 5.5 主进程 ↔ 编辑器

通过 `Editor` 全局对象调用编辑器 API：

| 调用 | 说明 |
|------|------|
| `Editor.Scene.callSceneScript(pkgName, method, ...args)` | 调用 scene-script |
| `Editor.Panel.open(pkgName)` | 打开面板 |
| `Editor.Selection.select('node', id)` | 选中节点 |
| `Editor.Selection.select('asset', id)` | 选中资源 |
| `Editor.assetdb.queryPathByUuid(uuid)` | UUID → 路径 |
| `Editor.User.getUserData()` | 获取用户信息 |
| `Editor.Profile.getConfig(pkgName)` | 读取配置 |
| `Editor.log(msg)` / `Editor.warn(msg)` / `Editor.error(msg)` | 日志 |

---

## 6. 全局 API 规范（Preload 注入）

以下函数通过 `scene-script.js` 注入到游戏全局作用域，由 preload 或 webview.executeJavaScript 触发：

```js
// === 节点树 ===
window.__updateTree()              // 序列化当前场景节点树，通过 sendTree 发送
window.__tempNodeTree              // 缓存的节点树数据

// === 节点详情 ===
window.__getNodeDetail(nodeId)     // 获取单个节点的详细属性
window.__nodeDetail                // 缓存的节点详情

// === 节点高亮 ===
window.__setHoverMode(enabled)     // 开启/关闭悬停高亮
window.__locateNode(nodeId)        // 在场景视图中定位节点
window.__removeAllLocateNodes()    // 清除所有定位标记

// === 组件 ===
window.__getComponentDetail(compId)// 获取组件详情
window.__storeComponent(nodeId)    // 缓存组件到全局变量
window.__execComp(nodeId, method, args) // 执行组件方法

// === 设计模式 ===
window.__toggleDesignMode(enabled) // 开关设计模式（可拖拽）
window.__dragingSN                 // 当前拖拽的节点
window.__swapPos(...)              // 交换节点位置

// === FPS ===
window.__toggleFps(enabled)         // 开关 FPS 显示

// === 暂停 ===
window.__togglePaused(enabled)      // 暂停/恢复

// === 编译 ===
window.__reCompile()                // 触发脚本重新编译

// === 断点 ===
window.__toggleDC(enabled)          // 开关 DrawCall 分析
window.__toggleNodeBreakpoint(nodeId) // 设定节点断点

// === 调试 ===
window.__removeBreakpoint()         // 清除断点
window.__printPath()                // 打印节点路径
```

---

## 7. 场景脚本规范

### 7.1 节点树序列化格式

```typescript
interface NodeTree {
  id: string;           // 节点 UUID
  name: string;         // 节点名称
  active: boolean;      // 是否激活
  children: NodeTree[]; // 子节点
  _prefab?: string;     // Prefab 资源 UUID（如果是 Prefab 实例）
  coms?: string[];      // 组件 UUID 列表
  // FairyGUI 相关
  displayAsFairyTree?: boolean;
  childCount?: number;
}
```

### 7.2 节点详情格式

```typescript
interface NodeDetail {
  id: string;
  name: string;
  active: boolean;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  opacity: number;
  color: Color;
  skewX: number;
  skewY: number;
  zIndex: number;       // 可选（showZ 配置）
  group: string;
  parent: string;
  children: string[];
  coms: ComponentDetail[];
  _prefab?: string;
}
```

### 7.3 组件详情格式

```typescript
interface ComponentDetail {
  uuid: string;
  type: string;           // 组件类型名，如 "cc.Sprite"
  properties: Record<string, any>; // 属性键值对
  isCC_COM?: boolean;     // 是否为 CC 内置组件
  isDestroyed?: boolean;
}
```

### 7.4 属性值类型

| 类型 | 序列化方式 |
|------|-----------|
| `number` | 直接传递 |
| `string` | 直接传递 |
| `boolean` | 直接传递 |
| `cc.Vec2/Vec3` | `{ x, y }` 或 `{ x, y, z }` |
| `cc.Color` | `{ r, g, b, a }` (0-255) |
| `cc.Rect` | `{ x, y, width, height }` |
| `cc.Size` | `{ width, height }` |
| `cc.SpriteFrame` | `{ uuid, name }` |
| `cc.Node` | `{ uuid, name }` |
| `cc.Prefab` | `{ uuid, name }` |
| `cc.Asset` | `{ uuid, name, type }` |
| `Enum` | 数字值 |

---

## 8. 实现阶段

### Phase 1: 项目骨架搭建

- [ ] 创建 `packages/MyInspector/` 目录
- [ ] 编写 `package.json`（扩展清单）
- [ ] 编写 `config.json`（默认配置）
- [ ] 准备图标资源（icon.png, tray.png 等）
- [ ] 引入 Vue 3 + Vite 构建（或直接引入 CDN）
- [ ] 验证：`main.js` 的 `load()` 能被编辑器调用

### Phase 2: 主进程核心

- [ ] 实现 `main.js` — 窗口创建与管理
- [ ] 实现 `mainPreload.js` — 配置读写
- [ ] 实现 URL 构建逻辑（确定游戏 webview 加载地址）
- [ ] 实现配置管理（readConfig / saveConfig）
- [ ] 验证：菜单中能打开 Inspector 窗口，内嵌 webview 能加载游戏

### Phase 3: 渲染进程 UI 框架

- [ ] 编写 `index.html` — 整体布局骨架
- [ ] 实现 Vue 3 应用初始化
- [ ] 实现标签栏（Tab）切换
- [ ] 实现游戏面板（webview 嵌入 + 工具栏按钮）
- [ ] 实现基础样式（暗色主题 `dark.css`）
- [ ] 验证：UI 正常渲染，Tab 可切换

### Phase 4: IPC 通信层

- [ ] 定义所有 IPC 通道常量
- [ ] 主进程端：注册所有 IPC 监听器
- [ ] 渲染进程端：封装 `ipcRenderer` 调用
- [ ] 实现 preload.js — 游戏 webview 桥接
- [ ] 验证：渲染进程 ↔ 主进程 双向通信正常

### Phase 5: 场景脚本

- [ ] 实现 `scene-script.js`
- [ ] 实现节点树序列化 (`__updateTree`)
- [ ] 实现节点详情获取 (`__getNodeDetail`)
- [ ] 实现定位/高亮功能
- [ ] 实现设计模式（拖拽节点）
- [ ] 实现 FPS / 暂停控制
- [ ] 验证：能在 Inspector 中看到节点树，选中节点能定位

### Phase 6: 属性编辑器

- [ ] 实现节点属性面板 (`NodeDetailView`)
- [ ] 实现组件列表 (`NodeComponent`)
- [ ] 实现各类型属性编辑器（number/string/bool/Vec2/Vec3/Color/SpriteFrame/asset/enum）
- [ ] 实现属性实时修改回写
- [ ] 实现 Prefab 修改保存
- [ ] 验证：修改属性后游戏实时生效

### Phase 7: 高级功能

- [ ] 实现控制台日志面板（Console Panel）
- [ ] 实现搜索功能（节点/组件搜索）
- [ ] 实现 DevTools Tab 集成
- [ ] 实现 HTTP 代理
- [ ] 实现分辨率选择器
- [ ] 实现 Cocos 信息面板
- [ ] 验证：各面板功能正常

### Phase 8: 设置面板

- [ ] 实现设置面板 UI
- [ ] 实现主题切换（暗色/亮色）
- [ ] 实现中英文切换
- [ ] 实现所有配置项的读写
- [ ] 实现 localStorage 持久化
- [ ] 验证：设置修改后即时生效，重启后保持

### Phase 9: 系统托盘与菜果

- [ ] 实现系统托盘图标
- [ ] 实现托盘右键菜单
- [ ] 实现错误信息复制
- [ ] 实现窗口关闭/最小化处理
- [ ] 验证：托盘图标显示，菜单可用

### Phase 10: 扩展与兼容

- [ ] 实现 `plugins.json` 右键菜单扩展机制
- [ ] 实现 Extension Panel 扩展面板
- [ ] FairyGUI 支持（可选）
- [ ] 低版本 Electron 兼容（可选）
- [ ] 验收：全功能测试

---

## 9. 验收标准

### 9.1 基础功能检查清单

- [ ] 通过菜单 `Cocos Inspector → Preview Mode` 或 `Shift+Enter` 打开 Inspector 窗口
- [ ] 窗口标题显示 `MyInspector v3.0.0`
- [ ] 左侧游戏 panel 内嵌 webview 能加载游戏画面
- [ ] 右侧节点树显示当前场景完整层级
- [ ] 点击节点树中的节点 → 场景中对应节点高亮
- [ ] 选中节点后显示属性和组件列表
- [ ] 修改属性值 → 游戏画面实时更新
- [ ] 修改组件属性 → 实时生效
- [ ] 刷新按钮 → 游戏重新加载
- [ ] 暂停/恢复按钮 → 游戏暂停/恢复
- [ ] FPS 按钮 → FPS 信息显示/隐藏
- [ ] 静音按钮 → 游戏静音/恢复
- [ ] 悬停按钮 → 开启后鼠标悬停场景节点时 Inspector 同步选中
- [ ] 设计模式按钮 → 开启后可拖拽场景节点
- [ ] 分辨率按钮 → 弹出分辨率选择列表
- [ ] DevTools 按钮 → 打开游戏页面 Chrome DevTools
- [ ] 日志区域显示游戏 console.log/warn/error 输出
- [ ] Tab 切换到 Console 面板 → 显示历史日志
- [ ] Tab 切换到 Cocos 面板 → 显示引擎版本等信息
- [ ] 搜索框 → 可按名称搜索节点/组件

### 9.2 设置功能检查清单

- [ ] 点击设置齿轮图标 → 打开设置面板
- [ ] 语言切换 → 界面文本变为英文/中文
- [ ] 主题切换 → 暗色/亮色主题切换
- [ ] 日志数量调整 → 游戏视图下方日志条数变化
- [ ] 属性名左对齐 → 属性面板布局变化
- [ ] URL 参数 → 游戏 URL 附加自定义参数
- [ ] 自定义 URL → 菜单 "Open Custom Page" 打开自定义地址
- [ ] 视网膜模式 → 画面清晰度变化
- [ ] 空格暂停 → 按空格键暂停/恢复游戏
- [ ] 自动刷新节点树 → 开关后节点树更新行为变化
- [ ] 显示 Z 属性 → 节点属性面板出现/隐藏 Z 相关字段
- [ ] HTTP 代理 → 配置后游戏页面请求走代理

### 9.3 高级功能检查清单

- [ ] 运行时修改 Prefab 节点的属性 → 可保存回 Prefab 资源
- [ ] 在游戏页面执行 `global.sendLog('test')` → Inspector 日志区出现对应日志
- [ ] 在游戏页面执行 `global.prompt('title', 'default')` → Inspector 弹出输入框
- [ ] 系统托盘图标显示正常
- [ ] 托盘菜单 → Copy Last Error 可复制错误信息
- [ ] 窗口关闭再打开 → 状态保持
- [ ] 多个 Inspector 实例互不干扰

### 9.4 架构验收

- [ ] 所有 `.js` 文件为非混淆源码，可读可维护
- [ ] 使用 Vue 3 Composition API（或 Options API 但结构清晰）
- [ ] IPC 通道集中管理，有类型定义
- [ ] 主进程、preload、scene-script 三个进程边界清晰
- [ ] 扩展机制（plugins.json）可正常工作

---

## 附录 A: 与原始插件的差异

| 项目 | 原始插件 | 本复刻版 |
|------|----------|----------|
| 代码混淆 | 全部混淆 | 无混淆，完整源码 |
| Vue 版本 | Vue 2 | Vue 3 |
| 构建 | 无 | 可选 Vite 构建 |
| 低版本兼容 | 内置多个兼容文件 | 按需实现 |
| 百度统计 | 内置 tj.js | 移除，预留埋点接口 |
| 类型定义 | 无 | TypeScript / JSDoc |
| 扩展机制 | plugins.json | plugins.json + 事件总线 |

---

## 附录 B: 参考资料

- 原始插件目录: `packages/CocosInspector/`
- 原始 `package.json`: `packages/CocosInspector/package.json`
- 原始 `config.json`: `packages/CocosInspector/config.json`
- Cocos Creator 扩展文档: https://docs.cocos.com/creator/manual/zh/extension/
