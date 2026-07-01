/**
 * Resource: linkup://rules/ui-contracts
 * Returns UI contract rules as Markdown.
 */
export const UI_CONTRACTS_URI = 'linkup://rules/ui-contracts';
export function readUiContracts(_ctx) {
    const markdown = `# LinkUpClient UI Contracts (MCP Resource)

## Prefab / Root / UIName Alignment
- Prefab filename (without .prefab), root node \`_name\`, and \`UIName\` constant must be identical.
- Example: \`UISet.prefab\` → root node name = \`UISet\` → \`UIName.UISet = "UISet"\`

## Dynamic addComponent
- \`view.addComponent(XxxCtrl)\` is the pattern for local UI controller attachment.
- Controller class must match the import in UIController.ts handler method.

## Node Paths
- Paths are relative to the prefab root node.
- Format: \`rootName/childName/grandchildName\`
- \`getChildByUrl("path")\` looks up a node by path in the hierarchy.
- Button listeners use the same path format: \`AddButtonListener("path", handler, this)\`

## Button Requirements
- Nodes referenced by \`AddButtonListener\` or \`AddDelayButtonListener\` must have a \`cc.Button\` component.
- Mouse listeners (\`AddMOUSEListener\`) do not require a Button component.

## Registration
- **Global**: UI is registered in \`UIController.ts\` with \`UIControllerName\` and shown via \`IE_ShowUIView(UIName.X)\`.
- **Local**: UI is shown directly via \`UIManager.Instance.IE_ShowUIView(UIName.X)\` + immediate \`view.addComponent\`.
- **Unregistered**: No UIName or controller registration found.

## Static vs Runtime Boundary
- MCP tools operate only on static file analysis.
- Dynamic path construction (template literals, concatenation) cannot be statically verified.
- \`packages\` directory does not exist and must not be depended upon.
`;
    return { mimeType: 'text/markdown', text: markdown };
}
//# sourceMappingURL=ui-contracts.js.map