# LinkUpClient Architecture Reference

## Engine and Configuration

- Engine: Cocos Creator 2.4.15, TypeScript with `experimentalDecorators` enabled.
- `project.json`: `"engine": "cocos-creator-js"`, version `"2.4.15"`.
- `tsconfig.json`: target `es5`, module `commonjs`, libs `es2015`/`es2017`/`dom`.
- Generated directories — never edit as source: `library/`, `temp/`, `build/`, `local/`, `settings/`.

## Entry Path and UIRoot Initialization

1. `LinkUp.ts` is the entry `@ccclass` component attached to the Canvas scene node.
2. `onLoad()` calls `startPlay()` which:
   - Sets design resolution via `util.setDesignResolution(true)`.
   - Loads `BundleMain` asset bundle.
   - Loads `GUI/UIRoot` prefab from the bundle.
   - Instantiates and adds it to `Canvas`.
   - Adds `UIRootUICtrl` to the UIRoot node.
3. `UIRootUICtrl.onLoad()` calls `loadComponent()` to register all root managers.

## Manager and Component Ownership

`UIRootUICtrl.loadComponent()` adds these managers to the UIRoot node:

| Manager | Type | Purpose |
|---|---|---|
| `ResManager` | `cc.Component` | Asset bundle and resource loading |
| `UIManager` | `cc.Component` | UI instantiation, z-index, and view lifecycle |
| `MapManager` | `cc.Component` | Game map logic (added twice — baselined duplicate) |
| `GameControl` | `cc.Component` | Game flow control |
| `SoundManager` | `cc.Component` | Music and sound effect playback |
| `UIController` | `cc.Component` | Central event routing for UI views |
| `SpriteAtlasManager` | `cc.Component` | Sprite atlas loading |
| `DataManager` | `cc.Component` | Data model management |

`UIManager.Init()` receives `RootCanvas/MiddlePanel` as the runtime UI parent node.

## UIComponent Base Class

`UIComponent` extends `cc.Component`. All UI controllers extend it.

- `onLoad()`: recursively caches all child node paths into `this.view` map.
- `getChildByUrl(url)`: returns a cached node by its relative path from root (e.g., `"bg/closeBtn"`).
- `AddButtonListener(url, func, target)`: registers click handler; requires `cc.Button` on the target node.
- `AddDelayButtonListener(url, func, target)`: same but with 500ms cooldown for spam prevention.
- `AddMOUSEListener(url, enter, leave, target)`: PC hover behavior.
- `addUIEventListener(name, func, target)`: registers with `EventManager` and auto-cleans on destroy.
- `emitUI(name, data?)`: emits through `EventManager`.
- `adaptUI()`: moves `top` and `bottom` groups for tall-screen safe area.
- Button lock: static `isButtonLocked` flag with `update(dt)` countdown.

## UIManager

- `ShowUIPrefab(prefab, parent)`: instantiates under parent (default `uiRoot`), stores in `uiMap` by `prefab.data.name`. Refuses duplicate names.
- `IE_ShowUIView(viewName)`: async. Loads `GUI/<viewName>` from `BundleMain`, calls `ShowUIPrefab`.
- `DestroyUIView(viewName)`: destroys node and removes from map.
- `isUiMapHas(name)`: returns existing node or undefined.
- Key instance by `uiPrefab.data.name` — root node name must match prefab filename.

## UIController (Central Event Router)

Located at `Scripts/Manager/UIController.ts`. Extends `UIComponent`.

- `onLoad()`: registers listeners for all `UIControllerName.*` events.
- Each handler follows the pattern:
  ```ts
  async uiFoo(data?) {
      const view = await UIManager.Instance.IE_ShowUIView(UIName.UIFoo);
      if (!view) return;
      view.addComponent(UIFooUICtrl).initData(data);
  }
  ```
- Imports and registers every global UI controller.
- UI that opens via `emitUI(UIControllerName.xxx)` must be registered here.

## EventManager

- Singleton pattern: `EventManager.getInstance()`.
- `on(eventName, func, target)`: registers listener.
- `off(eventName, func, target)`: removes listener.
- `emit(eventName, data?)`: fires event.
- `clear()`: removes all listeners.
- `UIComponent.onDestroy()` automatically removes registered events.

## Dynamic addComponent Convention

UI controllers are **not** pre-attached to GUI prefabs. The standard pattern is:

1. `UIManager.IE_ShowUIView(UIName.X)` loads and instantiates the prefab.
2. `view.addComponent(XUICtrl)` attaches the controller after instantiation.
3. Controller's `onLoad()` runs, calls `super.onLoad()` to cache paths, then sets up UI.

## Node-Path Caching Behavior

`UIComponent.onLoad()` → `traverseAllChildren()` recursively walks all children and builds a flat path map:

- Paths are relative to root: `"bg"`, `"bg/closeBtn"`, `"top/title"`.
- The path uses `/` separator with no leading slash.
- `getChildByUrl()` returns `undefined` for missing paths — callers must null-check.
- `label_<id>` naming triggers automatic text loading from `Tables/json/tblabel`.

## Gameplay Module Boundaries

Game logic managers (`GameManager`, `PlayerManager`, `DataManager`, `MapManager`) handle:
- Level/stage data, scoring, player state.
- Network requests via `HttpManager` and `GameSocketService`.

Existing UI controllers directly import and call these managers. For example:
- `UIRootUICtrl` uses `GameManager`, `PlayerManager`, `HttpManager`, `SoundManager`, `SDKAdapter`.
- `UILoginUICtrl` uses `PlayerManager`, `HttpManager`.
- `UIMainUICtrl` uses `GameManager`, `PlayerManager`, `SoundManager`.

When adding or modifying UI, follow the pattern of the closest existing implementation. UI can directly use existing Manager and Service singletons. Do not introduce new abstraction layers or refactor existing working patterns for the sake of separation — keep changes minimal and consistent with neighboring code.

## Bundle and Resource Loading

- `BundleName.BundleMain` is constructed as `"Bundle" + cpConfig.cpName`.
- All GUI prefabs live under `assets/BundleLLK/GUI/`.
- Resources loaded via `ResManager.IE_GetAsset(bundleName, path, type)`.
- Prefab path in bundle: `GUI/<UIName>` (no `.prefab` extension in load call).
- Art resources: `assets/ResLLK/ui/`, `assets/ResLLK/font/`, `assets/BundleLLK/Art/prefab/`.
- `packages` directory does not exist. Do not reference or recreate it.

## Generated Directories (Do Not Edit)

- `library/` — Cocos Creator compiled assets.
- `temp/` — Temporary build artifacts.
- `build/` — Build output.
- `local/` — Local editor settings.
- `settings/` — Project settings.
