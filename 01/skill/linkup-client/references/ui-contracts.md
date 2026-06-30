# LinkUpClient UI Contracts

## Design Baseline

- Portrait: **750 × 1334** design resolution.
- Fullscreen backgrounds often use 1000×2000; popups commonly use ~570×475; toast bars commonly use 750×92.
- Set via `util.setDesignResolution(true)` at startup.

## Naming Contract

The following three values **must** be identical for every global UI:

| Element | Example | Location |
|---|---|---|
| Prefab filename | `UISet.prefab` | `assets/BundleLLK/GUI/` |
| Root node name | `UISet` (first `cc.Node` in JSON) | Inside the prefab |
| `UIName` value | `UIName.UISet = "UISet"` | `assets/Scripts/Constant.ts` |

`UIManager` keys instances by `uiPrefab.data.name`. Mismatched names cause duplicate creation or lookup failures.

## Central vs. Local UI Registration

### Central (Global) Registration

For UI opened via event routing through `UIController`:

1. Add `UIName.UIFoo = "UIFoo"` to `Constant.ts`.
2. Add `UIControllerName.UIController_uiFoo = "UIController_uiFoo"` to `Constant.ts`.
3. Import controller in `UIController.ts`.
4. Add `addUIEventListener(UIControllerName.UIController_uiFoo, this.uiFoo, this)` in `UIController.onLoad()`.
5. Add handler method that calls `IE_ShowUIView` then `addComponent`.

### Local-Only Registration

For UI not routed through `UIController`:

1. Show: `const view = await UIManager.Instance.IE_ShowUIView(UIName.X)`.
2. Attach: `view.addComponent(XUICtrl)` immediately after.
3. No `UIControllerName` or `UIController.ts` change needed.

## Dynamic Controller Attachment

UI controllers are **not** pre-attached to prefabs. The standard flow:

```ts
const view = await UIManager.Instance.IE_ShowUIView(UIName.UIFoo);
if (!view) return;
view.addComponent(UIFooUICtrl).initData(data);
```

The controller's `onLoad()` calls `super.onLoad()` to cache all child paths, then sets up buttons and listeners.

## Node Hierarchy as Code API

Every `getChildByUrl("bg/closeBtn")` and `AddButtonListener("top/title", ...)` path must exist in the prefab hierarchy. The path is relative to the root node, using `/` separator, no leading slash.

- `UIComponent.onLoad()` recursively caches all children at startup.
- Missing paths return `undefined` — controller code must null-check.
- Renaming or moving a node breaks all path references silently at runtime.

## Button Component Requirements

Any node registered with `AddButtonListener(url, func, target)` or `AddDelayButtonListener(url, func, target)` **must** have a `cc.Button` component. The helper logs `console.error` if the node or button component is missing.

- `AddButtonListener`: standard click handler.
- `AddDelayButtonListener`: click handler with 500ms cooldown (spam prevention for network actions).

## Established Grouping Patterns

Existing prefabs use these common top-level groups:

| Group | Purpose |
|---|---|
| `bg` / `bg2` | Main background panels; `bg2` often for secondary states |
| `top` | Top bar area; moved by `adaptUI()` for safe area |
| `bottom` | Bottom bar area; moved by `adaptUI()` for safe area |
| `mask` | Full-screen touch blocker |
| `touch` | Touch interaction area |
| `guide*` | Guide overlay nodes |
| `error` | Error state display |
| `item` / `content` | List item templates and scroll content |
| `right` | Right-side panels |

## Modal Blockers

For modal popup views:

- Use a fullscreen `mask` node sized ~10000×10000 with `cc.Sprite` + `cc.BlockInputEvents`.
- Add `cc.Button` only when the mask itself should be clickable (e.g., dismiss on tap).
- `cc.BlockInputEvents` prevents touch pass-through to views below.

## Asset Locations

| Type | Location |
|---|---|
| UI sprites | `assets/ResLLK/ui/` (subdirs: `Common/`, `Bg/`, `Win/`, `game/`, `main/`, `tip/`, `Bag/`, `Share/`, `Set/`, `Rank/`, `First/`, `GK/`, `Direction/`, `score/`) |
| Main font | `assets/ResLLK/font/yl.ttf` |
| BMFont | `assets/ModuleRes/fonts/3500Chinese*.fnt` |
| LabelSDF prefabs | `assets/BundleLLK/Lab/` |
| Effect prefabs | `assets/BundleLLK/Art/prefab/` |
| GUI prefabs | `assets/BundleLLK/GUI/` |
| Sprite atlases | Managed by `SpriteAtlasManager` |

## Cocos Creator 2.x Prefab JSON

- Prefabs are JSON arrays with object references by `{"__id__": n}`.
- Element `[0]` is `cc.Prefab` metadata.
- Element `[1]` is the root `cc.Node` (its `_name` must match the filename).
- Preserve `_prefab` entries, component order, and `.meta` files when editing.
- Prefer duplicating a similar existing prefab over hand-authoring from scratch.

## Historical Exceptions

Known baselined issues exist (e.g., `UIRewardCommon` root named `UIRewardInfo`, duplicate `MapManager` addComponent). Do not normalize these unless explicitly authorized — they are tracked in the G1 baseline.
