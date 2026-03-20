import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const GET_TEAM_CYCLES = `
  query GetTeamCycles($teamId: String!) {
    team(id: $teamId) {
      cycles {
        nodes {
          id
          number
          name
          startsAt
          endsAt
          completedAt
          isActive
          isFuture
          isPast
        }
      }
    }
  }
`

const GET_TEAM_ID = `
  query GetTeamIdByKey($team: String!) {
    teams(filter: { key: { eq: $team } }) {
      nodes { id }
    }
  }
`

export function registerCycleTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_cycles",
      description: "List cycles for a team.",
      inputSchema: {
        type: "object",
        properties: {
          teamKey: {
            type: "string",
            description: "Team key (e.g. 'ENG')",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["teamKey"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)

        // Resolve team key to ID
        const teamData = await client.request(GET_TEAM_ID, {
          team: (args.teamKey as string).toUpperCase(),
        })
        const teamNodes = (teamData as { teams: { nodes: Array<{ id: string }> } })
          .teams.nodes
        if (teamNodes.length === 0) {
          throw new Error(`Team "${args.teamKey}" not found`)
        }

        const data = await client.request(GET_TEAM_CYCLES, {
          teamId: teamNodes[0].id,
        })
        const cycles =
          (data as { team: { cycles: { nodes: unknown[] } } }).team.cycles.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(cycles, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
