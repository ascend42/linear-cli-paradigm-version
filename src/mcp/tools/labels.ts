import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const LIST_LABELS = `
  query ListLabels($filter: IssueLabelFilter, $first: Int, $after: String) {
    issueLabels(filter: $filter, first: $first, after: $after) {
      nodes {
        id
        name
        description
        color
        team {
          key
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
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

export function registerLabelTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_labels",
      description:
        "List issue labels, optionally filtered by team. Returns both team-specific and workspace-level labels.",
      inputSchema: {
        type: "object",
        properties: {
          teamKey: {
            type: "string",
            description: "Filter by team key (e.g. 'ENG')",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)

        let filter: Record<string, unknown> | undefined
        if (args.teamKey) {
          const teamData = await client.request(GET_TEAM_ID, {
            team: (args.teamKey as string).toUpperCase(),
          })
          const teamNodes = (
            teamData as { teams: { nodes: Array<{ id: string }> } }
          ).teams.nodes
          if (teamNodes.length === 0) {
            throw new Error(`Team "${args.teamKey}" not found`)
          }
          filter = {
            or: [
              { team: { id: { eq: teamNodes[0].id } } },
              { team: { null: true } },
            ],
          }
        }

        const data = await client.request(LIST_LABELS, {
          filter,
          first: 100,
        })
        const labels =
          (data as { issueLabels: { nodes: unknown[] } }).issueLabels.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(labels, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
