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
export function buildSceneTreeExpression(maxDepth: number, maxNodes: number): string {
  // Ensure parameters are safe integers
  const depth = Math.min(Math.max(Math.floor(maxDepth), 1), 8);
  const nodes = Math.min(Math.max(Math.floor(maxNodes), 1), 2000);

  return `
(function() {
  var MAX_DEPTH = ${depth};
  var MAX_NODES = ${nodes};
  var nodeCount = 0;

  function serializeNode(node, depth) {
    if (!node || depth > MAX_DEPTH || nodeCount >= MAX_NODES) return null;
    nodeCount++;

    var result = {
      name: node.name || '',
      active: !!node.active,
      position: node.position ? { x: node.position.x, y: node.position.y } : null,
      size: node.getContentSize ? (function() { var s = node.getContentSize(); return { width: s.width, height: s.height }; })() : null,
      opacity: typeof node.opacity === 'number' ? node.opacity : null,
      components: []
    };

    // Extract component names (whitelist-safe)
    if (node._components) {
      for (var i = 0; i < node._components.length; i++) {
        var comp = node._components[i];
        if (comp && comp.constructor && comp.constructor.name) {
          result.components.push(comp.constructor.name);
        }
      }
    }

    // Recurse children
    var children = node._children || node.children;
    if (children && children.length > 0 && depth < MAX_DEPTH && nodeCount < MAX_NODES) {
      result.children = [];
      for (var c = 0; c < children.length; c++) {
        var child = serializeNode(children[c], depth + 1);
        if (child) result.children.push(child);
        if (nodeCount >= MAX_NODES) {
          result.childrenTruncated = true;
          break;
        }
      }
    }

    return result;
  }

  var scene = cc.director.getScene();
  if (!scene) return { error: 'No active scene' };

  var tree = serializeNode(scene, 0);
  return { tree: tree, totalNodes: nodeCount, truncated: nodeCount >= MAX_NODES };
})()
`.trim();
}

/**
 * Build a safe expression to get node detail by path.
 */
export function buildNodeDetailExpression(nodePath: string): string {
  // Validate nodePath: only allow alphanumeric, underscore, slash, dot
  if (!/^[A-Za-z0-9_./\- ]+$/.test(nodePath)) {
    throw new Error('Invalid node path: contains disallowed characters');
  }
  if (nodePath.length > 512) {
    throw new Error('Node path too long (max 512 characters)');
  }

  // Escape for safe embedding in JS string
  const escapedPath = nodePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `
(function() {
  var path = '${escapedPath}';
  var scene = cc.director.getScene();
  if (!scene) return { error: 'No active scene' };

  var node = null;
  if (path === '' || path === '/') {
    node = scene;
  } else {
    // Try getChildByPath first (Cocos 2.x has this)
    if (scene.getChildByPath) {
      node = scene.getChildByPath(path);
    }
    // Fallback: walk manually
    if (!node) {
      var parts = path.split('/').filter(function(p) { return p.length > 0; });
      node = scene;
      for (var i = 0; i < parts.length; i++) {
        var found = null;
        var children = node._children || node.children || [];
        for (var c = 0; c < children.length; c++) {
          if (children[c].name === parts[i]) { found = children[c]; break; }
        }
        if (!found) { node = null; break; }
        node = found;
      }
    }
  }

  if (!node) return { error: 'Node not found: ' + path };

  var result = {
    name: node.name || '',
    path: path,
    active: !!node.active,
    position: node.position ? { x: node.position.x, y: node.position.y } : null,
    size: node.getContentSize ? (function() { var s = node.getContentSize(); return { width: s.width, height: s.height }; })() : null,
    opacity: typeof node.opacity === 'number' ? node.opacity : null,
    anchorPoint: node.getAnchorPoint ? (function() { var a = node.getAnchorPoint(); return { x: a.x, y: a.y }; })() : null,
    components: [],
    childrenCount: (node._children || node.children || []).length
  };

  if (node._components) {
    for (var i = 0; i < node._components.length; i++) {
      var comp = node._components[i];
      if (comp && comp.constructor) {
        result.components.push({
          name: comp.constructor.name || 'Unknown',
          enabled: comp.enabled !== false
        });
      }
    }
  }

  return result;
})()
`.trim();
}

/**
 * Build a safe expression to get runtime status info.
 */
export function buildStatusExpression(): string {
  return `
(function() {
  var scene = cc.director.getScene();
  var canvas = cc.Canvas.instance;
  var res = canvas ? canvas.designResolution : null;
  var visibleSize = cc.view.getVisibleSize ? cc.view.getVisibleSize() : null;
  return {
    scene: scene ? scene.name : null,
    resolution: res ? { width: res.width, height: res.height } : null,
    visibleSize: visibleSize ? { width: visibleSize.width, height: visibleSize.height } : null,
    fps: cc.game.config ? cc.game.config.frameRate : null,
    pageUrl: window.location.href
  };
})()
`.trim();
}
