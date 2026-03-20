import type { ToolRegistry } from "../registry.ts"
import { getWorkspaceInfo } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

export function registerWorkspaceTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_workspaces",
      description:
        "List all configured Linear workspaces and which one is the default. Use this to discover available workspaces before making other calls.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    () => {
      try {
        const info = getWorkspaceInfo()
        const result = {
          workspaces: info.workspaces,
          defaultWorkspace: info.defaultWorkspace ?? null,
        }
        return Promise.resolve({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        })
      } catch (error) {
        return Promise.resolve(formatError(error))
      }
    },
  )
}
