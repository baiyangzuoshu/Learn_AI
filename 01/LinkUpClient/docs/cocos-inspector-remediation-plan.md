# CocosInspector 复刻 — 修补计划书

> **状态**: 基础架构已完成（Phase 1-10 验收通过），但功能深度不足。
> **目标**: 分 4 轮迭代，将复刻版提升到与原版功能对等的水平。

---

## 迭代 R1: 打通数据管道（必须最先做）

不完成这轮，Inspector 面板大部分区域都是空的。

### R1.1 `preload.js` — 自动拦截游戏日志

**问题**: 当前 `global.consoleLog()` 需要游戏代码主动调用，实际游戏的所有 `console.log/warn/error` 都不会出现在 Inspector 中。

**修改文件**: `packages/MyInspector/preload.js`

**修改内容**: 在文件末尾（`console.log('[CocosInspector] Preload script loaded');` 之后）追加：

```js
// ============================================================
// 拦截游戏 console 输出，自动转发到 Inspector
// ============================================================

(function hookConsole() {
  var _log = console.log;
  var _warn = console.warn;
  var _error = console.error;
  var _debug = console.debug || console.log;

  function formatArgs(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (typeof a === 'object') {
        try { parts.push(JSON.stringify(a)); }
        catch(e) { parts.push(String(a)); }
      } else {
        parts.push(String(a));
      }
    }
    return parts.join(' ');
  }

  console.log = function() {
    _log.apply(console, arguments);
    try { global.consoleLog(formatArgs(arguments)); } catch(e) {}
  };

  console.warn = function() {
    _warn.apply(console, arguments);
    try { global.consoleWarn(formatArgs(arguments)); } catch(e) {}
  };

  console.error = function() {
    _error.apply(console, arguments);
    try { global.consoleError(formatArgs(arguments)); } catch(e) {}
  };

  console.debug = function() {
    _debug.apply(console, arguments);
    try { global.consoleLog(formatArgs(arguments)); } catch(e) {}
  };
})();
```

**验收**: 游戏代码中的 `console.log('hello')` 自动出现在 Inspector 控制台面板中。

---

### R1.2 `scene-script.js` — 实时节点树推送

**问题**: 节点树靠 2 秒定时器拉取，游戏内节点变化不会实时反映。

**修改文件**: `packages/MyInspector/scene-script.js`

**修改 1**: 在 `SCENE_API_SOURCE` 数组末尾（`'})();'` 之前）插入：

```js
// ---- 实时节点树自动推送 ----
'window.__treeChangeTimer=null;',
'window.__enableAutoTree=function(){',
'if(window.__treeChangeTimer)return;',
'window.__treeChangeTimer=setInterval(function(){',
'if(!__isCCReady())return;',
'var s=cc.director.getScene();if(!s)return;',
'var t=__serializeNode(s,0);',
'var prev=window.__tempNodeTree;',
'window.__tempNodeTree=t;',
'// 只在树结构有变化时推送',
'if(JSON.stringify(t)!==JSON.stringify(prev)){',
'if(typeof sendTree==="function")sendTree(t);',
'}',
'},500);',
'};',
'window.__disableAutoTree=function(){',
'if(window.__treeChangeTimer){clearInterval(window.__treeChangeTimer);window.__treeChangeTimer=null;}',
'};',
'window.__enableAutoTree();',
```

**修改 2**: 在 `__getNodeDetail` 函数中，设置详情后追加节点树更新：

找到 `'window.__nodeDetail=d;if(typeof showNodeDetail==="function")showNodeDetail(d);'` 这一行，替换为：

```js
'window.__nodeDetail=d;if(typeof showNodeDetail==="function")showNodeDetail(d);',
// 选中节点后立即更新一次节点树（激活状态可能已变）
'window.__treeChangeTimer&&clearTimeout(window.__treeChangeTimer);',
'window.__treeChangeTimer=setTimeout(function(){__updateTree();},300);',
```

**验收**: 
- 游戏内创建/销毁节点后，Inspector 节点树在 0.5 秒内自动更新
- 选中节点后节点树立即刷新

---

### R1.3 `scene-script.js` — 悬停模式（鼠标移动到节点 → Inspector 选中）

**问题**: `__setHoverMode` 只设置标志，没有实际事件监听。

**修改文件**: `packages/MyInspector/scene-script.js`

在 `SCENE_API_SOURCE` 中替换当前的 `__setHoverMode` 部分：

找到：
```js
'window.__hoverEnabled=false;',
'window.__setHoverMode=function(e){window.__hoverEnabled=!!e;};',
```

替换为：
```js
'window.__hoverEnabled=false;',
'window.__hoverMoveBound=false;',
'window.__setHoverMode=function(e){',
'window.__hoverEnabled=!!e;',
'if(e&&!window.__hoverMoveBound){',
'cc.game.canvas.addEventListener("mousemove",function(ev){',
'if(!window.__hoverEnabled||!__isCCReady())return;',
'var s=cc.director.getScene();if(!s)return;',
'var x=ev.offsetX||ev.clientX,y=ev.offsetY||ev.clientY;',
'function findNodeAt(n,rx,ry){',
'if(!n||!n.active)return null;',
'if(n.children)for(var i=n.children.length-1;i>=0;i--){var f=findNodeAt(n.children[i],rx,ry);if(f)return f;}',
'var p=n.getPosition();var a=n.anchorX||0.5;var ay=n.anchorY||0.5;',
'var w=n.width||0,h=n.height||0;',
'if(w>0&&h>0){var lx=p.x-a*w,rx2=lx+w,by=p.y-ay*h,ty=by+h;',
'if(x>=lx&&x<=rx2&&y>=by&&y<=ty)return n;}',
'return null;',
'}',
'var hit=findNodeAt(s,x,y);',
'if(hit&&hit!==window.__lastHoverNode){',
'window.__lastHoverNode=hit;',
'__getNodeDetail(hit.uuid||hit._id);',
'}',
'});',
'window.__hoverMoveBound=true;',
'}',
'};',
'window.__lastHoverNode=null;',
```

**验收**: Inspector 中开启悬停按钮后，鼠标在游戏画面上移动，Inspector 自动选中并显示鼠标下方节点的属性。

---

## 迭代 R2: 补齐控制台与节点树交互

### R2.1 `index.html` + `app.js` — 控制台面板增强

**修改文件**: `packages/MyInspector/index.html`

在控制台面板区域（`<div v-show="activeTab === 'console'"` 内部），在日志循环之前添加工具栏：

```html
<div v-show="activeTab === 'console'" class="consolePanel" ref="consolePanel">
  <!-- 新增：控制台工具栏 -->
  <div class="consoleToolbar">
    <button @click="consoleFilter='all'" :class="{active:consoleFilter==='all'}">All</button>
    <button @click="consoleFilter='Log'" :class="{active:consoleFilter==='Log'}">Log</button>
    <button @click="consoleFilter='Warn'" :class="{active:consoleFilter==='Warn'}">Warn</button>
    <button @click="consoleFilter='Error'" :class="{active:consoleFilter==='Error'}">Error</button>
    <button @click="clearConsole">Clear</button>
  </div>
  <!-- 原有日志循环，改为 filteredConsoleLogs -->
  <div v-for="(log, idx) in filteredConsoleLogs" :key="idx" :class="'consoleLine console' + log.type">
    <span class="consoleTime">{{ log.time }}</span>
    <span class="consoleMsg">{{ log.msg }}</span>
  </div>
  <!-- 新增：JS 代码执行 -->
  <div class="consoleInputRow">
    <input type="text" v-model="consoleCode" @keyup.enter="executeConsoleCode"
      placeholder="JS code to execute in game..." />
  </div>
</div>
```

**修改文件**: `packages/MyInspector/app.js`

在 `setup()` 中添加（已有部分变量，确认以下都存在）：

```js
const consoleFilter = ref('all');
const consoleCode = ref('');

const filteredConsoleLogs = computed(() => {
  if (consoleFilter.value === 'all') return consoleLogs.value;
  return consoleLogs.value.filter(l => l.type === consoleFilter.value);
});

function clearConsole() {
  consoleLogs.value = [];
}

function setConsoleFilter(type) {
  consoleFilter.value = type;
}

function executeConsoleCode() {
  if (!consoleCode.value) return;
  const wv = document.getElementById('gameWebview');
  if (wv && wv.executeJavaScript) {
    wv.executeJavaScript('try{' + consoleCode.value + '}catch(e){console.error(e)}');
  }
  addConsoleLog('Log', '> ' + consoleCode.value);
  consoleCode.value = '';
}
```

在 `return {}` 中确保导出: `consoleFilter, filteredConsoleLogs, consoleCode, clearConsole, setConsoleFilter, executeConsoleCode`

**验收**: 控制台可按级别过滤、清空、输入 JS 代码执行。

---

### R2.2 `scene-script.js` — 节点树交互增强

**修改文件**: `packages/MyInspector/scene-script.js`

在 `SCENE_API_SOURCE` 末尾追加：

```js
// ---- 节点激活切换 ----
'window.__toggleNodeActive=function(id){',
'if(!__isCCReady())return;var s=cc.director.getScene();if(!s)return;',
'var n=__findNode(s,id);if(n){n.active=!n.active;__updateTree();}',
'};',
```

**修改文件**: `packages/MyInspector/app.js`

在 `node-view` 组件的 template 中，修改眼球图标行为，使其可点击：

找到：
```
<span :class="'nodeIcon ' + (n.active ? 'iconfont icon-yanjing' : 'iconfont icon-yanjing1')"></span>
```

替换为：
```
<span :class="'nodeIcon ' + (n.active ? 'iconfont icon-yanjing' : 'iconfont icon-yanjing1')" 
      @click.stop="toggleActive(n.id)"></span>
```

在 `node-view` 的 `methods` 中添加：

```js
methods: {
  toggle() { this.n.close = !this.n.close; },
  toggleActive(id) {
    this.n.active = !this.n.active;
    const wv = document.getElementById('gameWebview');
    if (wv && wv.executeJavaScript) {
      wv.executeJavaScript("window.__toggleNodeActive('" + id + "')");
    }
  },
},
```

**验收**: 点击节点树中的眼球图标可切换节点激活状态。

---

### R2.3 `index.html` — 节点树搜索按组件名匹配

**修改文件**: `packages/MyInspector/app.js`

增强 `filterNodes` 函数，加入组件名匹配：

```js
function filterNodes(nodes, query) {
  const result = [];
  for (const node of nodes) {
    // 按名称匹配
    const matchName = node.name && node.name.toLowerCase().includes(query);
    // 按组件名匹配
    const matchComp = node.coms && node.coms.some(function(c) {
      return c && c.toLowerCase && c.toLowerCase().includes(query);
    });
    const filteredChildren = node.children ? filterNodes(node.children, query) : [];
    if (matchName || matchComp || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}
```

**验收**: 搜索框输入组件名（如 "Sprite"）可过滤出含该组件的节点。

---

## 迭代 R3: 补齐属性编辑器与设计模式

### R3.1 `scene-script.js` — 设计模式真实拖拽

**修改文件**: `packages/MyInspector/scene-script.js`

替换当前的 `__toggleDesignMode` 和 `__swapPos` 部分：

找到 `'window.__designMode=false;'` 到 `'};'` (swapPos 结束) 这一段，替换为：

```js
'window.__designMode=false;',
'window.__dragingSN=null;',
'window.__dragStartPos=null;',
'window.__toggleDesignMode=function(e){',
'window.__designMode=!!e;if(!e){window.__dragingSN=null;window.__dragStartPos=null;}',
'if(e&&!window.__designModeBound){',
'window.__designModeBound=true;',
'var canvas=cc.game.canvas;',
'canvas.addEventListener("mousedown",function(ev){',
'if(!window.__designMode||!__isCCReady())return;',
'var s=cc.director.getScene();if(!s)return;',
'var x=ev.offsetX||ev.clientX,y=ev.offsetY||ev.clientY;',
'function findNodeAt(n,rx,ry){',
'if(!n||!n.active)return null;',
'if(n.children)for(var i=n.children.length-1;i>=0;i--){var f=findNodeAt(n.children[i],rx,ry);if(f)return f;}',
'var p=n.getPosition();var a=n.anchorX||0.5;var ay=n.anchorY||0.5;',
'var w=n.width||0,h=n.height||0;',
'if(w>0&&h>0){var lx=p.x-a*w,rx2=lx+w,by=p.y-ay*h,ty=by+h;',
'if(x>=lx&&x<=rx2&&y>=by&&y<=ty)return n;}return null;}',
'var hit=findNodeAt(s,x,y);',
'if(hit){window.__dragingSN=hit;window.__dragStartPos={x:x-hit.getPosition().x,y:y-hit.getPosition().y};}',
'});',
'canvas.addEventListener("mousemove",function(ev){',
'if(!window.__dragingSN)return;',
'var nx=ev.offsetX||ev.clientX,ny=ev.offsetY||ev.clientY;',
'window.__dragingSN.setPosition(nx-window.__dragStartPos.x,ny-window.__dragStartPos.y);',
'});',
'canvas.addEventListener("mouseup",function(){',
'if(window.__dragingSN){window.__dragingSN=null;window.__dragStartPos=null;__updateTree();}',
'});',
'}',
'};',
```

**验收**: 开启设计模式后，可在游戏画面上拖拽移动节点。

---

### R3.2 `index.html` + `app.js` — 组件属性编辑器增强：Enum 下拉框

**修改文件**: `packages/MyInspector/app.js`

在 `showNodeDetail` 函数的组件属性类型推断中，追加 Enum 检测。

找到 `richProps.push({ key: k, type: t, value: v });` 这一行（约 522 行），在其前面添加：

```js
// 检测 cc.Enum 类型
if (t === 'number' && comp.type) {
  try {
    var compClass = cc.js.getClassByName(comp.type);
    if (compClass && compClass.__values__ && compClass.__values__.indexOf) {
      var enumIdx = compClass.__values__.indexOf(k);
      if (enumIdx >= 0) t = 'enum';
    }
  } catch(e) {}
}
```

在 `index.html` 组件属性编辑器中，在 `<!-- 文本回退 -->` 之前添加 Enum 处理：

```html
<!-- Enum 下拉 -->
<select v-else-if="p.type === 'enum'"
  :value="p.value"
  @change="updateCompProp(comp.uuid, p.key, Number($event.target.value))">
  <option v-for="(opt, idx) in comp.enumOptions[p.key]" :key="idx" :value="idx">{{ opt }}</option>
</select>
```

同时在 `showNodeDetail` 中，为每个组件生成 `enumOptions` 映射。

**验收**: Sprite 组件的 `type`、`sizeMode` 等 Enum 属性显示为下拉框。

---

## 迭代 R4: 补齐设置与杂项

### R4.1 `index.html` + `app.js` — 设置面板补全

**修改文件**: `packages/MyInspector/index.html`

在设置面板中，`sliderInput` 之后、保存按钮之前，追加以下配置项：

```html
<div class="settingRow">
  <label>{{ t('urlParams') }}</label>
  <input type="text" v-model="setting.urlParams" placeholder="?debug=true" />
</div>
<div class="settingRow">
  <label>{{ t('customUrl') }}</label>
  <input type="text" v-model="setting.customUrl" placeholder="http://localhost:8080" />
</div>
<div class="settingRow">
  <label>{{ t('clearLogAfterRefresh') }}</label>
  <input type="checkbox" v-model="setting.clearLogAfterRefresh" />
</div>
<div class="settingRow">
  <label>{{ t('openArrayLimit') }}</label>
  <input type="number" v-model.number="setting.openArrayLimit" min="0" max="50" />
</div>
<div class="settingRow">
  <label>{{ t('prefabFontSize') }}</label>
  <input type="number" v-model.number="setting.prefabFontSize" min="0.5" max="2" step="0.05" />
</div>
```

**修改文件**: `packages/MyInspector/app.js`

在 `setting` ref 初始化中追加默认值：
```js
urlParams: config.urlParams || '',
customUrl: config.customUrl || '',
clearLogAfterRefresh: !!config.clearLogAfterRefresh,
openArrayLimit: config.openArrayLimit || 5,
prefabFontSize: config.prefabFontSize || 1,
```

在 i18n 的 zh/en 中添加对应 key：
```js
urlParams: 'URL 参数',
customUrl: '自定义 URL',
clearLogAfterRefresh: '刷新后清空日志',
openArrayLimit: '数组展开长度',
prefabFontSize: 'Prefab 字号',
```

在 `return {}` 中不需要额外导出（`setting` 已导出，这些是其子属性）。

**验收**: 设置面板新增 5 个配置项，保存后持久化。

---

### R4.2 `app.js` + `index.html` — Cocos 信息面板增强

**修改文件**: `packages/MyInspector/app.js`

在 `onMounted` 中补充引擎信息收集：

```js
// 收集引擎详细信息
const wv = document.getElementById('gameWebview');
if (wv && wv.executeJavaScript) {
  setTimeout(() => {
    wv.executeJavaScript(`
      (function(){
        var info = {};
        if(typeof cc !== 'undefined'){
          info.engine = cc.ENGINE_VERSION || 'unknown';
          info.canvasSize = (cc.game.canvas ? cc.game.canvas.width+'x'+cc.game.canvas.height : 'unknown');
          info.frameRate = cc.game.getFrameRate ? cc.game.getFrameRate() : 60;
          info.totalNodes = 0;
          try{
            var s = cc.director.getScene();
            if(s) {
              function count(n){var c=1;if(n.children)for(var i=0;i<n.children.length;i++)c+=count(n.children[i]);return c;}
              info.totalNodes = count(s);
            }
          }catch(e){}
        }
        if(typeof sendLog === 'function') sendLog(JSON.stringify(info));
      })()
    `);
  }, 2000);
}
```

在 `addLog` 函数中检测引擎信息 JSON 并设置：

```js
// 检测引擎信息日志
if (msg && msg.indexOf('{"engine":"') === 0) {
  try {
    var info = JSON.parse(msg);
    if (info.engine) engineInfo.value = 'Cocos Creator ' + info.engine;
    if (info.canvasSize) engineVersion.value = info.canvasSize + ' / ' + info.frameRate + 'fps';
    return; // 不显示在日志中
  } catch(e) {}
}
```

**验收**: Cocos 面板显示引擎版本号、画布尺寸、帧率。

---

### R4.3 `app.js` — 场景名称显示

**修改文件**: `packages/MyInspector/app.js`

在 `updateTree` 函数中提取场景名：

```js
function updateTree(treeData) {
  nodeTree.value = treeData || [];
  // 提取场景名（根节点名）
  if (treeData && treeData.name) {
    sceneName.value = treeData.name;
  }
}
```

在 setup 中添加：`const sceneName = ref('');`

在 `index.html` 的层级 Tab 标签中显示场景名：
```html
<div class="tab" :class="{ active: activeTab === 'hierarchy' }" @click="activeTab = 'hierarchy'">
  {{ t('hierarchy') }} <span v-if="sceneName" style="opacity:0.5;font-size:0.8em;">- {{ sceneName }}</span>
</div>
```

**验收**: 节点树 Tab 标题显示当前场景名称。

---

## 实现顺序与依赖

```
R1.1 (preload console hook)     ← 无依赖，最先做
R1.2 (auto tree push)           ← 无依赖
R1.3 (hover mode)               ← 无依赖
    ↓
R2.1 (console panel)            ← 依赖 R1.1
R2.2 (node active toggle)       ← 依赖 R1.2
R2.3 (component search)         ← 无依赖
    ↓
R3.1 (design mode drag)         ← 无依赖
R3.2 (enum editor)              ← 无依赖
    ↓
R4.1 (settings completion)      ← 无依赖
R4.2 (cocos panel)              ← 依赖 R1.1
R4.3 (scene name)               ← 依赖 R1.2
```

建议每完成一轮就验收一次，不要一次性全部改完。
