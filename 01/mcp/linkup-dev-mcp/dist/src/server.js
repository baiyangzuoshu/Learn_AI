/**
 * MCP Server setup - uses low-level Server API for full capability control.
 * Does NOT use McpServer (which auto-injects listChanged: true).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { createProjectContext } from './project-context.js';
import { createLogger, setLogLevel } from './logger.js';
import { SERVER_VERSION } from './schemas/common.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { basename } from 'node:path';
// G4 Runtime imports
import { createCDPManager } from './runtime/cdp-manager.js';
import { RuntimeStatusInputSchema } from './schemas/runtime-status.js';
import { RuntimeSceneTreeInputSchema } from './schemas/runtime-scene-tree.js';
import { RuntimeNodeDetailInputSchema } from './schemas/runtime-node-detail.js';
import { RuntimeConsoleLogsInputSchema } from './schemas/runtime-console-logs.js';
import { RuntimeCapturePreviewInputSchema } from './schemas/runtime-capture-preview.js';
import { handleRuntimeStatus } from './tools/runtime-status.js';
import { handleRuntimeSceneTree } from './tools/runtime-scene-tree.js';
import { handleRuntimeNodeDetail } from './tools/runtime-node-detail.js';
import { handleRuntimeConsoleLogs } from './tools/runtime-console-logs.js';
import { handleRuntimeCapturePreview } from './tools/runtime-capture-preview.js';
// Schema imports
import { ValidateProjectInputSchema, ValidateProjectOutputSchema } from './schemas/validate-project.js';
import { InspectUiPrefabInputSchema, InspectUiPrefabOutputSchema } from './schemas/inspect-ui-prefab.js';
import { ResolveUiContractInputSchema, ResolveUiContractOutputSchema } from './schemas/resolve-ui-contract.js';
// Tool handlers
import { handleValidateProject } from './tools/validate-project.js';
import { handleInspectUiPrefab } from './tools/inspect-ui-prefab.js';
import { handleResolveUiContract } from './tools/resolve-ui-contract.js';
// Resource handlers
import { PROJECT_PROFILE_URI, readProjectProfile } from './resources/project-profile.js';
import { PROJECT_ARCHITECTURE_URI, readProjectArchitecture } from './resources/project-architecture.js';
import { UI_CONTRACTS_URI, readUiContracts } from './resources/ui-contracts.js';
import { VALIDATION_RULES_URI, readValidationRules } from './resources/validation-rules.js';
const logger = createLogger('server');
// Tool definitions
const TOOLS = [
    {
        name: 'validate_project',
        description: 'Run G1 static checks on the LinkUpClient project. Returns structured diagnostics with summary.',
        inputSchema: zodToJsonSchema(ValidateProjectInputSchema),
        outputSchema: zodToJsonSchema(ValidateProjectOutputSchema),
    },
    {
        name: 'inspect_ui_prefab',
        description: 'Inspect a UI prefab by name. Returns depth-limited node tree, components, and registration status.',
        inputSchema: zodToJsonSchema(InspectUiPrefabInputSchema),
        outputSchema: zodToJsonSchema(InspectUiPrefabOutputSchema),
    },
    {
        name: 'resolve_ui_contract',
        description: 'Resolve the full UI contract: prefab, UIName constant, controller, node paths, and registration.',
        inputSchema: zodToJsonSchema(ResolveUiContractInputSchema),
        outputSchema: zodToJsonSchema(ResolveUiContractOutputSchema),
    },
    // G4 Runtime Tools — always registered, even when not connected
    // Note: outputSchema intentionally omitted for Runtime tools because
    // the SDK validates structuredContent against it, but our structuredContent
    // contains only the data portion (not the full ToolEnvelope wrapper).
    {
        name: 'runtime_status',
        description: 'Get Cocos Creator preview runtime connection status. Returns disconnected if no preview is running.',
        inputSchema: zodToJsonSchema(RuntimeStatusInputSchema),
    },
    {
        name: 'runtime_scene_tree',
        description: 'Get the running scene node tree from Cocos Creator preview. Depth and node count limited.',
        inputSchema: zodToJsonSchema(RuntimeSceneTreeInputSchema),
    },
    {
        name: 'runtime_node_detail',
        description: 'Get detailed info for a specific node by path in the running Cocos preview.',
        inputSchema: zodToJsonSchema(RuntimeNodeDetailInputSchema),
    },
    {
        name: 'runtime_console_logs',
        description: 'Get buffered console logs from the Cocos Creator preview.',
        inputSchema: zodToJsonSchema(RuntimeConsoleLogsInputSchema),
    },
    {
        name: 'runtime_capture_preview',
        description: 'Capture a screenshot of the Cocos Creator browser preview.',
        inputSchema: zodToJsonSchema(RuntimeCapturePreviewInputSchema),
    },
];
// Resource definitions
const RESOURCES = [
    {
        uri: PROJECT_PROFILE_URI,
        name: 'project-profile',
        description: 'Project metadata: name, Cocos version, TypeScript settings, key directories.',
        mimeType: 'application/json',
    },
    {
        uri: PROJECT_ARCHITECTURE_URI,
        name: 'project-architecture',
        description: 'Project architecture overview: entry path, UIRoot, UIManager, UIController, bundles.',
        mimeType: 'text/markdown',
    },
    {
        uri: UI_CONTRACTS_URI,
        name: 'ui-contracts',
        description: 'UI contract rules: prefab naming, node paths, button requirements, registration patterns.',
        mimeType: 'text/markdown',
    },
    {
        uri: VALIDATION_RULES_URI,
        name: 'validation-rules',
        description: 'Available validation rules with IDs, descriptions, and severity levels.',
        mimeType: 'application/json',
    },
];
export async function createAndStartServer() {
    // 1. Load and validate config
    const configResult = loadConfig();
    if (configResult.error) {
        logger.error(`Configuration error: ${configResult.error.message}`);
        process.stderr.write(`FATAL: Configuration error\n`);
        process.exit(1);
    }
    const config = configResult.config;
    // 2. Set log level
    setLogLevel(config.logLevel);
    // 3. Create ProjectContext
    const ctxResult = await createProjectContext(config);
    if (ctxResult.error) {
        logger.error(`Project context error: ${ctxResult.error.message}`);
        process.stderr.write(`FATAL: Project context error\n`);
        process.exit(1);
    }
    const ctx = ctxResult.context;
    logger.info(`Project: ${basename(config.projectRoot)} (verified)`);
    logger.info('Baseline: linked');
    // 4. Create CDP Manager for G4 Runtime
    const cdpManager = createCDPManager({
        host: config.runtimeHost,
        port: config.runtimePort,
        timeoutMs: config.runtimeTimeoutMs,
        maxConsoleLogs: config.runtimeMaxConsoleLogs,
    });
    logger.info(`Runtime CDP target: ${config.runtimeHost}:${config.runtimePort}`);
    // 5. Create Server with explicit minimal capabilities (no listChanged)
    const server = new Server({
        name: 'linkup-dev-mcp',
        version: SERVER_VERSION,
    }, {
        capabilities: {
            tools: {},
            resources: {},
        },
    });
    // 5. Register request handlers
    // tools/list
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: TOOLS };
    });
    // tools/call
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        let result;
        switch (name) {
            case 'validate_project': {
                const parsed = ValidateProjectInputSchema.safeParse(args ?? {});
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleValidateProject(ctx, parsed.data);
                break;
            }
            case 'inspect_ui_prefab': {
                const parsed = InspectUiPrefabInputSchema.safeParse(args);
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleInspectUiPrefab(ctx, parsed.data);
                break;
            }
            case 'resolve_ui_contract': {
                const parsed = ResolveUiContractInputSchema.safeParse(args);
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleResolveUiContract(ctx, parsed.data);
                break;
            }
            // G4 Runtime Tools
            case 'runtime_status': {
                result = await handleRuntimeStatus(cdpManager, {});
                break;
            }
            case 'runtime_scene_tree': {
                const parsed = RuntimeSceneTreeInputSchema.safeParse(args ?? {});
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleRuntimeSceneTree(cdpManager, parsed.data);
                break;
            }
            case 'runtime_node_detail': {
                const parsed = RuntimeNodeDetailInputSchema.safeParse(args);
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleRuntimeNodeDetail(cdpManager, parsed.data);
                break;
            }
            case 'runtime_console_logs': {
                const parsed = RuntimeConsoleLogsInputSchema.safeParse(args ?? {});
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleRuntimeConsoleLogs(cdpManager, parsed.data);
                break;
            }
            case 'runtime_capture_preview': {
                const parsed = RuntimeCapturePreviewInputSchema.safeParse(args ?? {});
                if (!parsed.success) {
                    return {
                        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                        isError: true,
                    };
                }
                result = await handleRuntimeCapturePreview(cdpManager, parsed.data);
                break;
            }
            default:
                return {
                    content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: `Unknown tool: ${name}` }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
                    isError: true,
                };
        }
        return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result.ok ? result.data : undefined,
            isError: !result.ok,
        };
    });
    // resources/list
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return { resources: RESOURCES };
    });
    // resources/read
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        switch (uri) {
            case PROJECT_PROFILE_URI: {
                const result = readProjectProfile(ctx);
                return { contents: [{ uri, text: result.text, mimeType: result.mimeType }] };
            }
            case PROJECT_ARCHITECTURE_URI: {
                const result = readProjectArchitecture(ctx);
                return { contents: [{ uri, text: result.text, mimeType: result.mimeType }] };
            }
            case UI_CONTRACTS_URI: {
                const result = readUiContracts(ctx);
                return { contents: [{ uri, text: result.text, mimeType: result.mimeType }] };
            }
            case VALIDATION_RULES_URI: {
                const result = readValidationRules(ctx);
                return { contents: [{ uri, text: result.text, mimeType: result.mimeType }] };
            }
            default:
                throw new Error(`Unknown resource URI: ${uri}`);
        }
    });
    // 6. Create transport and connect
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('linkup-dev-mcp server started on stdio transport');
    return { server, transport, cdpManager };
}
//# sourceMappingURL=server.js.map