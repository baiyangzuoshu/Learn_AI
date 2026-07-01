/**
 * Resource: linkup://project/profile
 * Returns project metadata as JSON.
 */
import type { ProjectContext } from '../project-context.js';
export declare const PROJECT_PROFILE_URI = "linkup://project/profile";
export declare function readProjectProfile(ctx: ProjectContext): {
    mimeType: string;
    text: string;
};
//# sourceMappingURL=project-profile.d.ts.map