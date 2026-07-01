/**
 * Resource: linkup://project/profile
 * Returns project metadata as JSON.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export const PROJECT_PROFILE_URI = 'linkup://project/profile';
export function readProjectProfile(ctx) {
    const root = ctx.projectRoot;
    // Read project.json for Cocos version
    let cocosVersion = 'unknown';
    let projectName = 'LinkUpClient';
    const projectJsonPath = join(root, 'project.json');
    if (existsSync(projectJsonPath)) {
        try {
            const pj = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
            cocosVersion = pj.version ?? 'unknown';
            projectName = pj.name ?? 'LinkUpClient';
        }
        catch {
            // Non-fatal
        }
    }
    // Read tsconfig.json for TS settings
    let tsTarget = 'unknown';
    let tsModule = 'unknown';
    const tsconfigPath = join(root, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
        try {
            const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
            tsTarget = tsconfig.compilerOptions?.target ?? 'unknown';
            tsModule = tsconfig.compilerOptions?.module ?? 'unknown';
        }
        catch {
            // Non-fatal
        }
    }
    // Try to read design resolution from project settings
    let designResolution = 'not determinable from static files';
    const settingsPath = join(root, 'settings', 'project.json');
    if (existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            const w = settings['design-resolution-width'] ?? settings.designWidth;
            const h = settings['design-resolution-height'] ?? settings.designHeight;
            if (w && h) {
                designResolution = `${w}x${h}`;
            }
        }
        catch {
            // Non-fatal
        }
    }
    const profile = {
        projectName,
        cocosVersion,
        engine: 'cocos-creator-js',
        typescript: { target: tsTarget, module: tsModule },
        designResolution,
        keyDirectories: {
            assets: 'assets',
            scripts: 'assets/Scripts',
            gui: 'assets/BundleLLK/GUI',
            managers: 'assets/Scripts/Manager',
            uiControllers: 'assets/Scripts/UI',
        },
        capabilityMode: 'static-only',
        runtimeAvailable: false,
    };
    return { mimeType: 'application/json', text: JSON.stringify(profile, null, 2) };
}
//# sourceMappingURL=project-profile.js.map