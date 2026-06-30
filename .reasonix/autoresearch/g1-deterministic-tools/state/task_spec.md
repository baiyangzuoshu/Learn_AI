# G1: Deterministic Tools - linkup-check

## Goal
Implement `01/tools/linkup-check` with 5 rules, CLI, library interface, tests, baseline, and real project scanning.

## Scope
- M0: Freeze plan & samples
- M1: CLI skeleton & prefab base rules
- M2: Controller node path rules
- M3: UI registration & duplicate attach rules
- M4: Baseline & project-level stability

## Allowed Paths
- `01/tools/linkup-check/**`
- `01/docs/acceptance/G1-*.md`

## Forbidden Paths
- `01/LinkUpClient/**`
- `01/skill/**`
- `01/mcp/**`
- `01/agent/**`

## Rules to Implement
1. `prefab/json-valid` - JSON validity of prefab files
2. `ui/prefab-root-name` - Root node name matches file name
3. `ui/controller-node-paths` - Literal node paths exist in prefab tree
4. `ui/registration` - UI registration completeness
5. `component/duplicate-attach` - Same method duplicate addComponent

## Success Criteria
- CLI with --help, --project, --rule, --format, --baseline
- Exit codes: 0 (pass), 1 (errors), 2 (tool failure)
- Library interface: runChecks() -> CheckResult
- All 5 rules have pass/fail unit tests
- Baseline support with exact fingerprint matching
- Stable output across runs
- Real project scan finds known anomalies
