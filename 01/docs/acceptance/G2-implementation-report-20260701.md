# G2 Implementation Report

> Date: 2026-07-01
> Stage: G2
> Implementer: G2 Implementation AI
> Status: 等待独立验收 (awaiting independent acceptance)
> Version: v4 (revised: Scenario B starts with empty UIName/UIControllerName, pre-change EXIT=0)

## 1. Changed File List

```
01/skill/linkup-client/SKILL.md                          (created)
01/skill/linkup-client/agents/openai.yaml                (created)
01/skill/linkup-client/references/architecture.md        (created)
01/skill/linkup-client/references/ui-contracts.md        (created)
01/skill/linkup-client/references/validation.md          (created)
01/docs/acceptance/G2-implementation-report-20260701.md   (created, this file)
```

No other files were created or modified.

## 2. Interface or Plan Deviations

This is a revised report (v4) addressing independent acceptance feedback:
- v2 fixes: architecture.md corrected (UI can directly use Managers), validation.md baseline path/packages/severity fixed.
- v3 fixes: All three scenarios re-executed with independent temp projects; evidence authenticity verified; Scenario B uses G1-recognizable handler pattern.
- v4 fix: Scenario B starts with empty UIName/UIControllerName (no UINewPopup declared), pre-change check passes EXIT=0.

## 3. Commands and Exit Codes

### Preflight

| Command | Exit Code |
|---|---|
| `git status --short` | 0 |
| `git status --short -- 01/LinkUpClient` | 0 (empty) |
| `node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient` | 0 (14 info, 14 baselined, 5 passed) |
| `cd 01/tools/linkup-check && npm test` | 0 (71/71 pass) |

### Skill Initialization

| Command | Exit Code |
|---|---|
| `python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py linkup-client --path 01/skill --resources references --interface display_name="LinkUpClient Skill" --interface short_description="Inspect, modify, and validate LinkUpClient GUI and code" --interface default_prompt="Use $linkup-client to inspect and modify LinkUpClient UI or code"` | 0 |

### Metadata Generation

| Command | Exit Code |
|---|---|
| `python3 ~/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py 01/skill/linkup-client --interface display_name="LinkUpClient Skill" --interface short_description="Inspect, modify, and validate LinkUpClient GUI and code" --interface default_prompt="Use $linkup-client to inspect and modify LinkUpClient UI or code"` | 0 |

### Final Verification (v3)

| Command | Exit Code |
|---|---|
| `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py 01/skill/linkup-client` | 0 |
| `cd 01/tools/linkup-check && npm test` | 0 (71/71 pass) |
| `node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient` | 0 (14 info, 14 baselined, 5 passed) |
| `git status --short -- 01/LinkUpClient` | 0 (empty) |
| `git diff --check` | 0 |

## 4. Validator Result

```
$ python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py 01/skill/linkup-client
Skill is valid!
EXIT=0
```

Manual structure checks:
- File tree: exactly 5 files (SKILL.md, openai.yaml, 3 references)
- SKILL.md: 76 lines (under 500)
- No TODO or placeholder text
- No README or unrelated files
- Frontmatter: only `name` and `description` keys; `name` is `linkup-client`
- All three references linked from SKILL.md body
- `default_prompt` in openai.yaml contains `$linkup-client`
- No MCP dependency declared

## 5. Scenario Evidence

All scenarios used independent temporary projects with no `packages` field in project.json and empty baseline `[]`.

---

### Scenario A: Modify an existing popup button/text node

**Temp project:** `/private/tmp/g2-scenario-a/`

**Setup:** `UITestPopup.prefab` (root: UITestPopup, children: bg/closeBtn with cc.Button, mask, title with cc.Label), `UITestPopupUICtrl.ts` (references `bg/closeBtn` and `title`), Constant.ts with only `UITestPopup`, minimal UIController stub.

#### Prefab JSON parse

```
$ python3 -c "import json; json.load(open('/private/tmp/g2-scenario-a/assets/BundleLLK/GUI/UITestPopup.prefab')); print('JSON valid, EXIT=0')"
JSON valid, EXIT=0
```

#### Fixture TypeScript syntax check

```
$ node --check /private/tmp/g2-scenario-a/assets/Scripts/UI/UITestPopupUICtrl.ts && echo "TS syntax OK, EXIT=0"
TS syntax OK, EXIT=0
```

#### Pre-change targeted check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json -r ui/controller-node-paths
Summary: 1 passed
EXIT=0
```

#### Pre-change complete check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json
WARNING ui/registration
  assets/BundleLLK/GUI/UITestPopup.prefab
  Subject: UITestPopup
  Prefab "UITestPopup" has no UIController registration in UIController.ts
  Suggestion: If this is a global UI, register it in UIController.ts and add UIName to Constant.ts
Summary: 1 warning, 5 passed
EXIT=0
```

The WARNING is expected: UITestPopup is a local-only view (opened via `addComponent` without UIController routing).

#### Modification

Added `confirmBtn` node under `bg` with `cc.Button` component in the prefab JSON. Updated controller to add `AddButtonListener("bg/confirmBtn", this.onConfirmClick, this)`. Changed title label text from "Original Title" to "Modified Title".

#### Post-change targeted check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json -r ui/controller-node-paths
Summary: 1 passed
EXIT=0
```

#### Post-change complete check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json
WARNING ui/registration
  assets/BundleLLK/GUI/UITestPopup.prefab
  Subject: UITestPopup
  Prefab "UITestPopup" has no UIController registration in UIController.ts
Summary: 1 warning, 5 passed
EXIT=0
```

**Result:** No new path or button error. The only WARNING is the same local-only view explanation as pre-change. 未执行运行态/视觉验收.

---

### Scenario B: Add and register a small global popup

**Temp project:** `/private/tmp/g2-scenario-b/`

**Setup:** Constant.ts with **empty** `UIName` and `UIControllerName` objects. No UINewPopup prefab, controller, or registration. Minimal UIController stub.

#### Pre-change complete check (empty project)

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-b --baseline /private/tmp/g2-scenario-b/baseline.json
Summary: 5 passed
EXIT=0
```

#### Modification (all added simultaneously)

1. `UINewPopup.prefab` — root: UINewPopup, children: bg/okBtn with cc.Button, mask
2. `UINewPopupUICtrl.ts` — extends UIComponent, `AddButtonListener("bg/okBtn", ...)`
3. Constant.ts — added `UIName.UINewPopup: "UINewPopup"` and `UIControllerName.UIController_uiNewPopup: "UIController_uiNewPopup"`
4. UIController.ts — added `this.addUIEventListener(UIControllerName.UIController_uiNewPopup, this.uiNewPopup, this)` in `onLoad()`, with handler: `async uiNewPopup(data?) { const view = await UIManager.Instance.IE_ShowUIView(UIName.UINewPopup); if (!view) return; view.addComponent(UINewPopupUICtrl).initData(data); }`

#### Prefab JSON parse

```
$ python3 -c "import json; json.load(open('/private/tmp/g2-scenario-b/assets/BundleLLK/GUI/UINewPopup.prefab')); print('JSON valid, EXIT=0')"
JSON valid, EXIT=0
```

#### TypeScript syntax check

```
$ node --check /private/tmp/g2-scenario-b/assets/Scripts/UI/UINewPopupUICtrl.ts && \
node --check /private/tmp/g2-scenario-b/assets/Scripts/Manager/UIController.ts && \
echo "TS syntax OK, EXIT=0"
TS syntax OK, EXIT=0
```

#### Post-change complete check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-b --baseline /private/tmp/g2-scenario-b/baseline.json
Summary: 5 passed
EXIT=0
```

**Result:** Complete checker exits 0 with 5 rules passed. No registration, path, or root-name diagnostic for UINewPopup. UIName, UIControllerName, prefab root name, controller file, `addUIEventListener` with `IE_ShowUIView` and dynamic `addComponent` all correctly recognized by the G1 static checker. 未执行运行态/视觉验收.

**Cleanup:** Temporary project `/private/tmp/g2-scenario-b/` deleted.

---

### Scenario C: Diagnose and repair a node-path issue

**Temp project:** `/private/tmp/g2-scenario-a/` (reused from Scenario A, known-good state)

#### Known-good state targeted check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json -r ui/controller-node-paths
Summary: 1 passed
EXIT=0
```

#### Introduced broken path

Added `this.AddButtonListener("bg/nonExistentBtn", this.onNonExistentClick, this)` at line 7 of `UITestPopupUICtrl.ts`.

#### Broken state targeted check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json -r ui/controller-node-paths
ERROR ui/controller-node-paths
  assets/Scripts/UI/UITestPopupUICtrl.ts:7
  Subject: bg/nonExistentBtn
  Node path "bg/nonExistentBtn" does not exist in prefab assets/BundleLLK/GUI/UITestPopup.prefab (checked as "UITestPopup/bg/nonExistentBtn" relative to root)
  Suggestion: Verify the path matches the prefab hierarchy or update the controller
Summary: 1 error, 0 passed
EXIT=1
```

#### Repair

Removed the `bg/nonExistentBtn` reference from the controller.

#### Repaired targeted check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json -r ui/controller-node-paths
Summary: 1 passed
EXIT=0
```

#### Repaired complete check

```
$ node 01/tools/linkup-check/bin/linkup-check.mjs --project /private/tmp/g2-scenario-a --baseline /private/tmp/g2-scenario-a/baseline.json
WARNING ui/registration
  assets/BundleLLK/GUI/UITestPopup.prefab
  Subject: UITestPopup
  Prefab "UITestPopup" has no UIController registration in UIController.ts
Summary: 1 warning, 5 passed
EXIT=0
```

**Result:** Broken path detected with rule `ui/controller-node-paths`, file `assets/Scripts/UI/UITestPopupUICtrl.ts`, line 7, subject `bg/nonExistentBtn`. Minimal repair clears it. Complete checker exits 0 with only the local-only view WARNING. 未执行运行态/视觉验收.

**Cleanup:** All temporary projects (`/private/tmp/g2-scenario-a/`, `/private/tmp/g2-scenario-b/`) deleted.

## 6. Real Project Before/After Status

### Before (preflight)

```
$ git status --short -- 01/LinkUpClient
(empty)

$ node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
Summary: 14 info, 14 baselined, 5 passed
EXIT=0
```

### After (final self-test v3)

```
$ git status --short -- 01/LinkUpClient
(empty)

$ node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
Summary: 14 info, 14 baselined, 5 passed
EXIT=0
```

**Comparison:** Identical. No changes to `01/LinkUpClient`.

## 7. Known Limitations and Skipped Checks

- No Cocos Creator Editor runtime verification performed.
- No device/emulator visual verification performed.
- Prefab JSON structures in scenarios were hand-authored (not generated by Cocos Creator). The checker's JSON parser handles this correctly.
- The `label_<id>` auto-loading feature of UIComponent was not tested in scenarios.
- TypeScript full compilation was not run (Cocos Creator `cc` namespace required).

## 8. Cocos Runtime/Visual Verification Statement

未执行运行态/视觉验收。静态验证通过。本实施未打开 Cocos Creator Editor，未在任何设备或模拟器上运行游戏，未验证视觉布局、动画或交互效果。所有验证均为 G1 静态检查器的结果。

## 9. Commands for Independent Acceptance AI

```bash
# 1. Verify directory structure
find 01/skill/linkup-client -type f | sort

# 2. Run quick_validate.py
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py 01/skill/linkup-client

# 3. Verify SKILL.md line count and no TODO
wc -l 01/skill/linkup-client/SKILL.md
grep -rn "TODO\|placeholder" 01/skill/linkup-client/ || echo "None"

# 4. Verify frontmatter
head -4 01/skill/linkup-client/SKILL.md

# 5. Verify openai.yaml
cat 01/skill/linkup-client/agents/openai.yaml

# 6. Verify real project unchanged
git status --short -- 01/LinkUpClient

# 7. Verify G1 checker still passes
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient

# 8. Verify personal skill untouched
ls ~/.codex/skills/linkup-cocos-ui-prefab/SKILL.md

# 9. Run git diff --check
git diff --check

# 10. List all untracked G2 files
git status --short -- 01/skill/ 01/docs/acceptance/
```

## 10. git diff --check and Untracked G2 Files

```
$ git diff --check
(no output, EXIT=0)
```

Untracked G2 files:
```
01/skill/linkup-client/SKILL.md
01/skill/linkup-client/agents/openai.yaml
01/skill/linkup-client/references/architecture.md
01/skill/linkup-client/references/ui-contracts.md
01/skill/linkup-client/references/validation.md
01/docs/acceptance/G2-implementation-report-20260701.md
```

## Final Statement

本实施 AI 不自我宣布 G2 验收通过。实施完成，等待独立验收 AI 判定。
