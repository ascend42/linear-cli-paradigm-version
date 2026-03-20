import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

// Load credentials at startup (side-effect import)
import "../credentials.ts"

import { ToolRegistry } from "./registry.ts"
import { registerWorkspaceTools } from "./tools/workspaces.ts"
import { registerTeamTools } from "./tools/teams.ts"
import { registerIssueTools } from "./tools/issues.ts"
import { registerProjectTools } from "./tools/projects.ts"
import { registerCycleTools } from "./tools/cycles.ts"
import { registerDocumentTools } from "./tools/documents.ts"
import { registerLabelTools } from "./tools/labels.ts"
import { registerCommentTools } from "./tools/comments.ts"

/**
 * Start the MCP server over stdio transport.
 */
export async function startServer(): Promise<void> {
  // Build tool registry
  const registry = new ToolRegistry()
  registerWorkspaceTools(registry)
  registerTeamTools(registry)
  registerIssueTools(registry)
  registerProjectTools(registry)
  registerCycleTools(registry)
  registerDocumentTools(registry)
  registerLabelTools(registry)
  registerCommentTools(registry)

  // Create MCP server
  const server = new Server(
    {
      name: "linear-cli",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  // Wire tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: registry.getDefinitions(),
    }
  })

  // Wire tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const handler = registry.getHandler(name)

    if (!handler) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      }
    }

    return await handler(args ?? {})
  })

  // Connect via stdio
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Run directly when this file is the entry point
if (import.meta.main) {
  startServer()
}
