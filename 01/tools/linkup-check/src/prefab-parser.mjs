/**
 * Prefab JSON parser for Cocos Creator 2.4.x prefabs.
 *
 * A Cocos Creator prefab is a JSON array where each element is a typed object.
 * The first element is typically cc.Prefab, and its .data points to the root node.
 * Nodes reference components via _components[].__id__ and children via _children[].__id__.
 */

/**
 * Parse a Cocos Creator prefab JSON string.
 * @param {string} jsonStr - Raw JSON content
 * @param {string} filePath - File path for error reporting
 * @returns {{ root: object, nodes: object[], components: object[], all: object[] } | { error: string }}
 */
export function parsePrefab(jsonStr, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { error: `Invalid JSON in ${filePath}: ${e.message}` };
  }

  if (!Array.isArray(parsed)) {
    return { error: `Prefab ${filePath} is not a JSON array (got ${typeof parsed})` };
  }

  const all = parsed;

  // Find the root node. In Cocos Creator prefabs, the first element is cc.Prefab,
  // and its data.__id__ points to the root node.
  const prefabObj = all[0];
  if (!prefabObj || !prefabObj.__type__ || !prefabObj.__type__.includes('cc.Prefab')) {
    // Try to find cc.Prefab by scanning
    let prefabIdx = -1;
    for (let i = 0; i < all.length; i++) {
      if (all[i] && all[i].__type__ && all[i].__type__.includes('cc.Prefab')) {
        prefabIdx = i;
        break;
      }
    }
    if (prefabIdx === -1) {
      return { error: `Prefab ${filePath}: cannot find cc.Prefab object` };
    }
    const dataRef = all[prefabIdx].data;
    if (!dataRef || dataRef.__id__ === undefined) {
      return { error: `Prefab ${filePath}: cc.Prefab has no data reference` };
    }
    const root = all[dataRef.__id__];
    if (!root) {
      return { error: `Prefab ${filePath}: root node reference invalid` };
    }
    return { root, nodes: [], components: [], all };
  }

  const dataRef = prefabObj.data;
  if (!dataRef || dataRef.__id__ === undefined) {
    return { error: `Prefab ${filePath}: cc.Prefab has no data reference` };
  }

  const root = all[dataRef.__id__];
  if (!root) {
    return { error: `Prefab ${filePath}: root node reference invalid` };
  }

  return { root, nodes: [], components: [], all };
}

/**
 * Get root node name from a parsed prefab.
 * @param {{ root: object, all: object[] }} parsed
 * @returns {string | null}
 */
export function getRootNodeName(parsed) {
  if (!parsed || !parsed.root) return null;
  return parsed.root._name || null;
}

/**
 * Walk the node tree from root, returning all nodes with depth info.
 * @param {{ root: object, all: object[] }} parsed
 * @returns {Array<{ node: object, name: string, depth: number, path: string }>}
 */
export function walkNodes(parsed) {
  if (!parsed || !parsed.root || !parsed.all) return [];

  const result = [];
  const all = parsed.all;

  function walk(nodeRef, depth, parentPath) {
    if (!nodeRef || nodeRef.__id__ === undefined) return;
    const node = all[nodeRef.__id__];
    if (!node || !node.__type__ || !node.__type__.includes('cc.Node')) return;

    const name = node._name || '';
    const path = depth === 0 ? name : `${parentPath}/${name}`;

    result.push({ node, name, depth, path });

    // Walk children
    if (node._children && Array.isArray(node._children)) {
      for (const childRef of node._children) {
        walk(childRef, depth + 1, path);
      }
    }
  }

  walk({ __id__: 0 }, -1, '');

  // The above won't work because we need to start from the root node reference.
  // Let's use a different approach - find root from the prefab data reference.
  const prefabObj = all[0];
  let rootNodeRef;

  if (prefabObj && prefabObj.__type__ && prefabObj.__type__.includes('cc.Prefab')) {
    rootNodeRef = prefabObj.data;
  } else {
    // Search for cc.Prefab
    for (let i = 0; i < all.length; i++) {
      if (all[i] && all[i].__type__ && all[i].__type__.includes('cc.Prefab')) {
        rootNodeRef = all[i].data;
        break;
      }
    }
  }

  if (!rootNodeRef || rootNodeRef.__id__ === undefined) return [];

  const rootNode = all[rootNodeRef.__id__];
  if (!rootNode) return [];

  const rootName = rootNode._name || '';
  result.push({ node: rootNode, name: rootName, depth: 0, path: rootName });

  if (rootNode._children && Array.isArray(rootNode._children)) {
    for (const childRef of rootNode._children) {
      walkNode(childRef, 1, rootName);
    }
  }

  function walkNode(nodeRef, depth, parentPath) {
    if (!nodeRef || nodeRef.__id__ === undefined) return;
    const node = all[nodeRef.__id__];
    if (!node || !node.__type__ || !node.__type__.includes('cc.Node')) return;

    const name = node._name || '';
    const path = `${parentPath}/${name}`;

    result.push({ node, name, depth, path });

    if (node._children && Array.isArray(node._children)) {
      for (const childRef of node._children) {
        walkNode(childRef, depth + 1, path);
      }
    }
  }

  return result;
}

/**
 * Get all components in the prefab.
 * @param {{ all: object[] }} parsed
 * @returns {Array<{ component: object, typeName: string, nodeIdx: number }>}
 */
export function getComponents(parsed) {
  if (!parsed || !parsed.all) return [];

  const result = [];
  const all = parsed.all;

  for (let i = 0; i < all.length; i++) {
    const obj = all[i];
    if (!obj || !obj.__type__) continue;

    // Check if this is a component (has a node reference and a __type__ that isn't cc.Node or cc.Prefab)
    if (obj.node && obj.node.__id__ !== undefined) {
      const typeName = obj.__type__.split('.').pop() || obj.__type__;
      result.push({ component: obj, typeName, nodeIdx: obj.node.__id__, idx: i });
    }
  }

  return result;
}

/**
 * Check if a node at a given path has a component of the given type.
 * @param {{ all: object[] }} parsed
 * @param {string} targetPath - Node path to check (e.g., "UIGame/bg/btnClose")
 * @param {string} componentType - Component type to look for (e.g., "cc.Button")
 * @returns {boolean}
 */
export function nodeHasComponent(parsed, targetPath, componentType) {
  const nodes = walkNodes(parsed);
  const targetNode = nodes.find(n => n.path === targetPath);
  if (!targetNode) return false;

  const all = parsed.all;
  const nodeObj = targetNode.node;

  if (!nodeObj._components || !Array.isArray(nodeObj._components)) return false;

  for (const compRef of nodeObj._components) {
    if (compRef && compRef.__id__ !== undefined) {
      const comp = all[compRef.__id__];
      if (comp && comp.__type__ && comp.__type__.includes(componentType)) {
        return true;
      }
    }
  }

  return false;
}
