import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const GET_TEAMS = `
  query GetTeams {
    teams(first: 100) {
      nodes {
        id
        name
        key
        description
        color
        cyclesEnabled
      }
    }
  }
`

export function registerTeamTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_teams",
      description: "List all teams in a Linear workspace.",
      inputSchema: {
        type: "object",
        properties: {
          workspace: {
            type: "string",
            description:
              "Workspace slug to target. Omit to use the default workspace.",
          },
        },
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)
        const data = await client.request(GET_TEAMS)
        const teams = (data as { teams: { nodes: unknown[] } }).teams.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(teams, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
