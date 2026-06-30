# CocosInspector - Complete Remaining Phases

## Goal
Finish phases 8-10 of the CocosInspector replica + fix Phase 7瑕疵.

## Scope
1. Fix Phase 7瑕疵: dwPreload.js, HTTP proxy backend, dead code
2. Phase 8: Settings panel completeness (localStorage, all config items)
3. Phase 9: System tray verification
4. Phase 10: plugins.json, extension panel, final verification

## Non-goals
- FairyGUI support (optional, defer)
- Low Electron version compatibility (optional, defer)

## Success Criteria
- [ ] dwPreload.js created with DevTools bridge
- [ ] HTTP proxy UI connected to session.setProxy()
- [ ] toggleDevToolTab dead code cleaned
- [ ] All 34 config items readable/writable in settings panel
- [ ] System tray icon + menu working
- [ ] plugins.json extensions loadable
- [ ] Extension Panel tab functional
- [ ] All JS files pass syntax check
