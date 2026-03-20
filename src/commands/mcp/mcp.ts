import { Command } from "@cliffy/command"

export const mcpCommand = new Command()
  .name("mcp")
  .description("MCP (Model Context Protocol) server for AI assistants")
  .command(
    "serve",
    new Command()
      .name("serve")
      .description("Start the MCP server over stdio transport")
      .action(async () => {
        const { startServer } = await import("../../mcp/server.ts")
        await startServer()
      }),
  )
