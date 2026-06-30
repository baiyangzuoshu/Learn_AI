# G1 Acceptance Record

> Date: 2026-06-30
> Status: Self-test complete (NOT self-validated — awaiting independent acceptance)
> Version: 0.1.4 (post 4 rounds of FAIL fixes)

## 1. Changed Files

```
01/tools/linkup-check/
├── package.json
├── linkup-check.config.json
├── linkup-check.baseline.json
├── bin/linkup-check.mjs
├── src/
│   ├── index.mjs           (library entry with validation)
│   ├── cli.mjs
│   ├── config.mjs
│   ├── diagnostics.mjs
│   ├── project-index.mjs
│   ├── prefab-parser.mjs
│   ├── ts-extractor.mjs
│   ├── reporters/text-reporter.mjs
│   ├── reporters/json-reporter.mjs
│   └── rules/
│       ├── prefab-json.mjs
│       ├── prefab-root-name.mjs
│       ├── controller-node-paths.mjs
│       ├── ui-registration.mjs
│       └── duplicate-component-attach.mjs
└── test/
    ├── fixtures/ (7 files)
    ├── prefab-json.test.mjs
    ├── prefab-root-name.test.mjs
    ├── controller-node-paths.test.mjs
    ├── ui-registration.test.mjs
    ├── duplicate-component-attach.test.mjs
    ├── cli.test.mjs
    ├── stability.test.mjs
    └── validation.test.mjs

01/docs/acceptance/
└── G1-acceptance-20260630.md
```

## 2. Interface Deviations from Plan

**No deviations.** Library interface, CLI parameters, exit codes, five rules all match plan.

## 3. Test Results

```
# tests 71
# pass 71
# fail 0
```

Suites: prefab-json(5), prefab-root-name(5), controller-node-paths(21), ui-registration(8), duplicate-component-attach(6), cli(13), stability(3), validation(10)

## 4. Real Project Scan Results

```
Total diagnostics: 28
By rule:
  ui/prefab-root-name: 3
  ui/controller-node-paths: 13
  ui/registration: 9
  component/duplicate-attach: 1
  prefab/json-valid: 0
Infos (dynamic paths): 14
```

Known anomalies correctly detected:
1. UIRewardCommon.prefab root name mismatch ✓
2. UIRootUICtrl duplicate MapManager ✓
3. UITip/UIADShareTip/UIEnd/UICommonTip2 UIName without matching prefab ✓

## 5. Baseline

- 14 entries (strictly validated: 16-char hex fingerprint, known ruleId, non-empty reason)
- Duplicate detection and expiry detection active
- Invalid baseline JSON → throws Error (exit 2)

## 6. Validation (applied to both CLI and library API)

| Input | Result |
|---|---|
| Invalid project directory | Error, exit 2 |
| Unknown rule ID | Error, exit 2 |
| Missing baseline file | Error, exit 2 |
| Non-array baseline | Error, exit 2 |
| Baseline entry missing fingerprint/ruleId/reason | Error, exit 2 |
| Baseline entry with bad fingerprint format | Error, exit 2 |

## 7. Commands for Independent Verification

```bash
cd 01/tools/linkup-check && node --test test/*.test.mjs
node 01/tools/linkup-check/bin/linkup-check.mjs --help
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient --format json
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient --baseline 01/tools/linkup-check/linkup-check.baseline.json
node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient -r ui/prefab-root-name
node 01/tools/linkup-check/bin/linkup-check.mjs --list-rules
```

## 8. Verification Gates

| ID | Item | Status |
|---|---|---|
| G1-01 | CLI --help | ✅ |
| G1-02 | Normal fixture | ✅ |
| G1-03 | Broken JSON | ✅ |
| G1-04 | Root name mismatch | ✅ |
| G1-05 | Missing node path | ✅ |
| G1-06 | Non-button listener | ✅ |
| G1-07 | Registration missing | ✅ |
| G1-08 | Duplicate attach | ✅ |
| G1-09 | JSON output | ✅ |
| G1-10 | Baseline | ✅ |
| G1-11 | Stability | ✅ |
| G1-12 | Real project scan | ✅ |

**NOT self-declaring G1 as PASS — awaiting independent acceptance.**

## 9. Fix History

| Round | Issues Fixed |
|---|---|
| FAIL-1 | Dynamic concat detection, root node name, invalid project, *Ctrl.ts scan, baseline dedup/expiry, stability test path, npm script path |
| FAIL-2 | Library project validation, unknown rule/baseline error handling, baseline expiry with rule filter, controller alias (UIPayTipUICtrl), globSync removal |
| FAIL-3 | Library unknown ruleIds, baseline entry validation, controller-to-prefab class extraction, registration line numbers, regression tests (7 new) |
| FAIL-4 | Baseline reason/hex/ruleId validation, registration alias class extraction |
