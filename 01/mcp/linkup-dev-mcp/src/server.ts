/**
 * MCP Server setup - uses low-level Server API for full capability control.
 * Does NOT use McpServer (which auto-injects listChanged: true).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { createProjectContext, type ProjectContext } from './project-context.js';
import { createLogger, setLogLevel } from './logger.js';
import { SERVER_VERSION } from './schemas/common.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { basename } from 'node:path';

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

export async function createAndStartServer(): Promise<{ server: Server; transport: StdioServerTransport }> {
  // 1. Load and validate config
  const configResult = loadConfig();
  if (configResult.error) {
    logger.error(`Configuration error: ${configResult.error.message}`);
    process.stderr.write(`FATAL: Configuration error\n`);
    process.exit(1);
  }
  const config = configResult.config!;

  // 2. Set log level
  setLogLevel(config.logLevel);

  // 3. Create ProjectContext
  const ctxResult = await createProjectContext(config);
  if (ctxResult.error) {
    logger.error(`Project context error: ${ctxResult.error.message}`);
    process.stderr.write(`FATAL: Project context error\n`);
    process.exit(1);
  }
  const ctx = ctxResult.context!;

  logger.info(`Project: ${basename(config.projectRoot)} (verified)`);
  logger.info('Baseline: linked');

  // 4. Create Server with explicit minimal capabilities (no listChanged)
  const server = new Server(
    {
      name: 'linkup-dev-mcp',
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // 5. Register request handlers

  // tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let result: any;
    switch (name) {
      case 'validate_project': {
        const parsed = ValidateProjectInputSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
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
            content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
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
            content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.message }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
            isError: true,
          };
        }
        result = await handleResolveUiContract(ctx, parsed.data);
        break;
      }
      default:
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: `Unknown tool: ${name}` }, meta: { serverVersion: SERVER_VERSION, generatedAt: new Date().toISOString(), truncated: false } }) }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
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

  return { server, transport };
}
