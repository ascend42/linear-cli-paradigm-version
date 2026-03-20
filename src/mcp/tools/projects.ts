import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const LIST_PROJECTS = `
  query ListProjects($filter: ProjectFilter, $first: Int, $after: String) {
    projects(filter: $filter, first: $first, after: $after) {
      nodes {
        id
        name
        description
        slugId
        icon
        color
        url
        status {
          name
          type
          color
        }
        lead {
          name
          displayName
        }
        priority
        health
        startDate
        targetDate
        completedAt
        canceledAt
        teams {
          nodes {
            key
          }
        }
        updatedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const VIEW_PROJECT = `
  query ViewProject($id: String!) {
    project(id: $id) {
      id
      name
      description
      slugId
      icon
      color
      url
      status {
        name
        type
        color
      }
      creator {
        name
        displayName
      }
      lead {
        name
        displayName
      }
      priority
      health
      startDate
      targetDate
      startedAt
      completedAt
      canceledAt
      createdAt
      updatedAt
      teams {
        nodes {
          id
          key
          name
        }
      }
      issues {
        nodes {
          id
          identifier
          title
          state {
            name
            type
          }
        }
      }
      lastUpdate {
        body
        health
        createdAt
        user {
          name
          displayName
        }
      }
    }
  }
`

// Helper to resolve team key
const GET_TEAM_ID = `
  query GetTeamIdByKey($team: String!) {
    teams(filter: { key: { eq: $team } }) {
      nodes { id }
    }
  }
`

export function registerProjectTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_projects",
      description: "List projects, optionally filtered by team or status.",
      inputSchema: {
        type: "object",
        properties: {
          teamKey: {
            type: "string",
            description: "Filter by team key (e.g. 'ENG')",
          },
          status: {
            type: "string",
            description:
              "Filter by status type: planned, started, paused, completed, canceled",
          },
          limit: {
            type: "number",
            description: "Maximum results (default: 50)",
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

        const filter: Record<string, unknown> = {}
        if (args.teamKey) {
          const data = await client.request(GET_TEAM_ID, {
            team: (args.teamKey as string).toUpperCase(),
          })
          const nodes = (data as { teams: { nodes: Array<{ id: string }> } })
            .teams.nodes
          if (nodes.length === 0) {
            throw new Error(`Team "${args.teamKey}" not found`)
          }
          filter.accessibleTeams = { id: { eq: nodes[0].id } }
        }
        if (args.status) {
          filter.status = { type: { eq: args.status } }
        }

        const limit = (args.limit as number) || 50
        const data = await client.request(LIST_PROJECTS, {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: limit,
        })
        const projects =
          (data as { projects: { nodes: unknown[] } }).projects.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  registry.register(
    {
      name: "linear_view_project",
      description: "Get full details of a single project by ID or slug ID.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Project UUID or slug ID",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["projectId"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)
        const data = await client.request(VIEW_PROJECT, {
          id: args.projectId as string,
        })
        const project = (data as { project: unknown }).project
        return {
          content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
