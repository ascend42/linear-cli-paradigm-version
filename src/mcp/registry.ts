/**
 * Tool registry — accumulates tool definitions and handlers from
 * multiple files, then exposes them for the MCP server to wire up.
 */

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>

export class ToolRegistry {
  private definitions: ToolDefinition[] = []
  private handlers = new Map<string, ToolHandler>()

  /**
   * Register a tool with its definition and handler.
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.definitions.push(definition)
    this.handlers.set(definition.name, handler)
  }

  /**
   * Get all registered tool definitions (for tools/list).
   */
  getDefinitions(): ToolDefinition[] {
    return this.definitions
  }

  /**
   * Get handler for a tool by name (for tools/call).
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name)
  }
}
