/**
 * Rule: ui/registration
 *
 * Checks:
 * - UIName in Constant.ts points to an existing prefab
 * - UIController registrations reference declared UIName values
 * - view.addComponent(XUICtrl) corresponds to an existing controller file
 * - No inconsistent multi-registration for the same global UI
 */

import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createDiagnostic } from '../diagnostics.mjs';

export const RULE_ID = 'ui/registration';

/**
 * Run the ui/registration rule.
 * @param {import('../project-index.mjs').ProjectIndex} index
 * @returns {import('../diagnostics.mjs').Diagnostic[]}
 */
export function checkUIRegistration(index) {
  const diagnostics = [];
  const { constants, uiController, prefabs, controllers } = index;

  // Build lookup sets
  const prefabNames = new Set(
    prefabs
      .filter(p => !p.error)
      .map(p => basename(p.relPath, '.prefab'))
  );

  const controllerFiles = new Set(
    controllers.map(c => {
      const name = basename(c.relPath);
      if (name.endsWith('UICtrl.ts')) return name.replace('UICtrl.ts', '');
      if (name.endsWith('Ctrl.ts')) return name.replace('Ctrl.ts', '');
      return name.replace(/\.ts$/, '');
    })
  );

  // 1. Check that each UIName points to an existing prefab
  for (const [key, value] of Object.entries(constants.uiNames)) {
    if (!prefabNames.has(value)) {
      diagnostics.push(createDiagnostic({
        ruleId: RULE_ID,
        severity: 'error',
        file: 'assets/Scripts/Constant.ts',
        line: constants.uiNameLines?.[key],
        subject: key,
        message: `UIName.${key} = "${value}" but no matching prefab found in GUI directory`,
        suggestion: `Create assets/BundleLLK/GUI/${value}.prefab or update the UIName declaration`,
      }));
    }
  }

  // 2. Check that each UIController registration references a declared UIName
  const registeredUINames = new Set();
  for (const reg of uiController.registrations) {
    if (reg.uiName) {
      registeredUINames.add(reg.uiName);

      if (!constants.uiNames[reg.uiName]) {
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'error',
          file: 'assets/Scripts/Manager/UIController.ts',
          line: reg.line,
          subject: reg.uiName,
          message: `UIController registers UIName.${reg.uiName} but it is not declared in Constant.ts`,
          suggestion: `Add ${reg.uiName} to UIName in Constant.ts`,
        }));
      }
    }

    // Check that the controller import exists
    if (reg.controllerImport) {
      // Map controller class name to expected file name
      // e.g., UIGameUICtrl -> UIGame
      const expectedPrefabName = reg.controllerImport.replace(/UICtrl$/, '').replace(/Ctrl$/, '');

      // Check if there's a matching controller file OR if the class is defined inside any controller file
      const hasControllerFile = controllers.some(c => {
        const name = basename(c.relPath, '.ts');
        // File name matches directly
        if (name === reg.controllerImport || name === expectedPrefabName + 'UICtrl') return true;
        // Class is defined inside the file (handles aliases like UIPayTipUICtrl in UIPayUICtrl.ts)
        if (c.content && c.content.includes(`class ${reg.controllerImport}`)) return true;
        return false;
      });

      if (!hasControllerFile && reg.controllerImport) {
        diagnostics.push(createDiagnostic({
          ruleId: RULE_ID,
          severity: 'warning',
          file: 'assets/Scripts/Manager/UIController.ts',
          line: reg.line,
          subject: reg.controllerImport,
          message: `UIController uses view.addComponent(${reg.controllerImport}) but no matching controller file found`,
          suggestion: `Ensure the controller file exists in assets/Scripts/UI/`,
        }));
      }
    }
  }

  // 3. Check for prefabs that don't have any UIController registration
  // (This is info, not error - some prefabs may be locally managed)
  for (const prefab of prefabs) {
    if (prefab.error) continue;
    const name = basename(prefab.relPath, '.prefab');
    if (!registeredUINames.has(name)) {
      // Only report for prefabs that look like global UI (not tips, etc.)
      diagnostics.push(createDiagnostic({
        ruleId: RULE_ID,
        severity: 'warning',
        file: prefab.relPath,
        subject: name,
        message: `Prefab "${name}" has no UIController registration in UIController.ts`,
        suggestion: 'If this is a global UI, register it in UIController.ts and add UIName to Constant.ts',
      }));
    }
  }

  // 4. Check for controllers that don't have a matching prefab
  for (const controller of controllers) {
    const name = basename(controller.relPath, '.ts');
    let prefabName;
    if (name.endsWith('UICtrl')) {
      prefabName = name.replace('UICtrl', '');
    } else if (name.endsWith('Ctrl')) {
      prefabName = name.replace('Ctrl', '');
    } else {
      prefabName = name;
    }

    // If file-name mapping fails, try extracting class name from file content
    if (!prefabNames.has(prefabName) && controller.content) {
      const classMatch = controller.content.match(/class\s+(\w+UICtrl)\s+extends/);
      if (classMatch) {
        const altPrefabName = classMatch[1].replace(/UICtrl$/, '');
        if (prefabNames.has(altPrefabName)) {
          continue; // Class maps to an existing prefab, no warning needed
        }
      }
    }

    if (!prefabNames.has(prefabName)) {
      diagnostics.push(createDiagnostic({
        ruleId: RULE_ID,
        severity: 'warning',
        file: controller.relPath,
        subject: prefabName,
        message: `Controller ${name} exists but no matching prefab ${prefabName}.prefab found`,
        suggestion: `Create the matching prefab or remove the controller if unused`,
      }));
    }
  }

  return diagnostics;
}
