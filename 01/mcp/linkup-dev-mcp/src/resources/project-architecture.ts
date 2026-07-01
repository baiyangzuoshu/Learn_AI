/**
 * Resource: linkup://project/architecture
 * Returns project architecture as Markdown.
 */

import type { ProjectContext } from '../project-context.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const PROJECT_ARCHITECTURE_URI = 'linkup://project/architecture';

export function readProjectArchitecture(ctx: ProjectContext): { mimeType: string; text: string } {
  const index = ctx.getIndex();

  const globalUIs = index.uiController.registrations.map(r => r.uiName).filter(Boolean);
  const allPrefabs = index.prefabs.map(p => p.relPath.split('/').pop()?.replace('.prefab', '') ?? '');
  const controllers = index.controllers.map(c => c.relPath.split('/').pop()?.replace('.ts', '') ?? '');

  // Read actual Cocos version from project.json
  let cocosVersion = 'unknown';
  const pjPath = join(ctx.projectRoot, 'project.json');
  if (existsSync(pjPath)) {
    try {
      const pj = JSON.parse(readFileSync(pjPath, 'utf-8'));
      cocosVersion = pj.version ?? 'unknown';
    } catch { /* non-fatal */ }
  }

  const markdown = `# LinkUpClient Architecture (MCP Resource)

## Entry Path
- Main entry: \`assets/Scripts/\`
- Project config: \`project.json\` (Cocos Creator ${cocosVersion})

## UI Hierarchy
- **UIRoot**: \`assets/BundleLLK/GUI/UIRoot.prefab\` — scene root, always loaded
- **UIManager**: \`assets/Scripts/Manager/UIManager.ts\` — singleton managing UI lifecycle
- **UIController**: \`assets/Scripts/Manager/UIController.ts\` — registration hub for global UIs

## UI Controllers
Global registrations (in UIController.ts):
${globalUIs.map(u => `- \`${u}\``).join('\n') || '- None registered'}

All controllers in \`assets/Scripts/UI/\`:
${controllers.map(c => `- \`${c}\``).join('\n') || '- None found'}

## UI Components
- UIComponent pattern: components cached on nodes, referenced via \`getChildByUrl\`
- Button listeners: \`AddButtonListener\`, \`AddDelayButtonListener\`, \`AddMOUSEListener\`

## Bundles
- \`BundleLLK\`: main bundle containing GUI prefabs
- \`assets/BundleLLK/GUI/\`: all UI prefab files

## Key Managers
- UIManager: singleton, \`UIManager.Instance\`
- MapManager, AudioManager, etc.: registered as components on UIRoot

## Constants
- \`assets/Scripts/Constant.ts\`: defines \`UIName\` and \`UIControllerName\` enums
- UIName maps display name → string identifier
- UIControllerName maps controller identifier → string identifier

## Prefabs (${allPrefabs.length} total)
${allPrefabs.map(p => `- \`${p}\``).join('\n') || '- None found'}

## Constraints
- \`packages\` directory has been removed; do not depend on it
- No runtime/visual verification is available through MCP
`;

  return { mimeType: 'text/markdown', text: markdown };
}
