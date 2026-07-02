/**
 * Whitelist of safe JavaScript expressions for CDP Runtime.evaluate.
 *
 * Only pre-defined expressions with validated parameters are allowed.
 * No arbitrary JavaScript execution is permitted.
 */
/**
 * Build a safe expression to get the scene tree.
 * Parameters are sanitized (numbers only for depth/nodes).
 */
export declare function buildSceneTreeExpression(maxDepth: number, maxNodes: number): string;
/**
 * Build a safe expression to get node detail by path.
 */
export declare function buildNodeDetailExpression(nodePath: string): string;
/**
 * Build a safe expression to get runtime status info.
 */
export declare function buildStatusExpression(): string;
//# sourceMappingURL=whitelist.d.ts.map