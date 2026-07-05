# G7 Pilot Report (A+B) — 2026-07-04

> Phase: G7 Real Business Pilot
> Status: A+B COMPLETE; C BLOCKED (awaiting user task selection)
> Execution AI: Reasonix (Codex-based)

## 1. G7 Scope Definition

Based on G1-G6 all PASS acceptance records, G7 is defined as: using the existing toolchain (Codex + linkup-client Skill + linkup-check + linkup-dev-mcp + Runtime) for real LinkUpClient business tasks.

### Custom Agent Host Decision

Per master plan §25.1, 5 conditions must be met. Only 1/5 is satisfied (Evals exist). **Current status: cannot enter custom Agent Host implementation.**

## 2. Pilot A: Full Diagnostic + Baseline Stability

### What was done
- Full `linkup-check` scan on `01/LinkUpClient/`
- Compared results with G1 acceptance data (2026-07-02)

### Results

| Metric | G1 Acceptance | Current | Delta |
|---|---|---|---|
| info | 14 | 14 | 0 |
| baselined | 14 | 14 | 0 |
| passedRules | 5 | 5 | 0 |
| errors | 0 | 0 | 0 |
| warnings | 0 | 0 | 0 |

### Conclusion
**Baseline completely stable. Zero drift. All 5 rules pass.**

### Evidence
```
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient --baseline 01/tools/linkup-check/linkup-check.baseline.json --format json
Summary: 14 info, 14 baselined, 5 passed
```

## 3. Pilot B: UIRewardCommon.prefab Full Diagnosis Loop

### What was done
- linkup-check targeted rule runs (ui/prefab-root-name, ui/registration, component/duplicate-attach)
- MCP `resolve_ui_contract` via stdio protocol
- MCP `inspect_ui_prefab` via stdio protocol
- Cross-verification between tools
- Protected path check

### 3.1 linkup-check Findings

| Rule | Severity | Description | Baseline Status |
|---|---|---|---|
| ui/prefab-root-name | error | File name UIRewardCommon ≠ root node name UIRewardInfo | baselined |
| ui/prefab-root-name | error | Root name "UIRewardInfo" duplicated in 2 prefabs | baselined |
| ui/registration | warning | No UIController registration for UIRewardCommon | baselined |

### 3.2 MCP `resolve_ui_contract` Result

```json
{
  "uiName": "UIRewardCommon",
  "prefabBasename": "UIRewardCommon.prefab",
  "prefabRelPath": "assets/BundleLLK/GUI/UIRewardCommon.prefab",
  "rootNodeName": "UIRewardInfo",
  "registrationStatus": "unregistered",
  "nodePaths": [],
  "status": "incomplete",
  "diagnostics": 9 (2 error baselined + 6 info + 1 warning baselined)
}
```

### 3.3 MCP `inspect_ui_prefab` Result

```
nodeCount: 30
returnedNodeCount: 30
Root: UIRewardInfo
Top-level children: mask, bg
bg children: bg1, 3, 1, 2, closeBtn, warn, title, closeBtn2, itemtip, item
item children: 3, 1, 2 (each with Sprite icon + Label num)
Key components: Button (closeBtn, closeBtn2), Layout (item), Label (title, warn)
```

### 3.4 Cross-Validation

| Aspect | linkup-check | MCP resolve_ui_contract | Consistent? |
|---|---|---|---|
| Root node name | UIRewardInfo | UIRewardInfo | ✅ |
| Registration | warning (no registration) | unregistered | ✅ |
| Root name duplication | 2 files share same root | diagnostics include same fingerprint | ✅ |

### 3.5 Protected Path Check
```
git status --short -- 01/LinkUpClient 01/tools 01/skill 01/mcp
(empty)
```

### Conclusion
**All three tools (Skill workflow + linkup-check + MCP) successfully chained on a real business prefab. Cross-validation confirms consistency. Zero protected-path changes.**

## 4. Pilot C: Real Business Modification (BLOCKED)

Status: **Awaiting user to specify a concrete low-risk modification task.**

Candidate tasks presented to user:
1. Fix UIRewardCommon.prefab root node name (UIRewardInfo → UIRewardCommon)
2. Fix UIRootUICtrl.ts duplicate addComponent(MapManager)
3. User-specified custom task

User has not yet selected. Cannot proceed per G7 rules: "如果用户还没有指定具体业务任务，你不能脑补实现需求"

## 5. Risk & Unverified Items

| Item | Status | Note |
|---|---|---|
| Runtime observation | Not verified | Cocos Creator preview not running |
| Runtime node path validation | Not verified | `bg/`, `bg/item/` paths need Runtime confirmation |
| Modification loop | Not verified | Read-only diagnosis only; no modify→verify cycle |
| Visual correctness | Not verified | Requires Cocos preview or screenshot |

## 6. Changed-File List

**None.** Both pilots were read-only diagnostics.

## 7. What's Next

- Pilot C: User selects a modification task → full modify→linkup-check→verify loop
- Optional: Runtime verification (requires Cocos Creator preview running)
