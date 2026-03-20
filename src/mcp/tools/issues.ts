import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const LIST_ISSUES = `
  query ListIssues($filter: IssueFilter!, $first: Int, $after: String) {
    issues(filter: $filter, first: $first, after: $after) {
      nodes {
        id
        identifier
        title
        priority
        estimate
        url
        assignee {
          name
          displayName
        }
        state {
          name
          type
          color
        }
        labels {
          nodes {
            name
            color
          }
        }
        project {
          name
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

const VIEW_ISSUE = `
  query ViewIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
      priority
      estimate
      url
      branchName
      dueDate
      assignee {
        name
        displayName
      }
      state {
        name
        type
        color
      }
      labels {
        nodes {
          name
          color
        }
      }
      project {
        name
      }
      projectMilestone {
        name
      }
      cycle {
        name
        number
      }
      parent {
        identifier
        title
      }
      children(first: 100) {
        nodes {
          identifier
          title
          state {
            name
            type
          }
        }
      }
      comments(first: 50, orderBy: createdAt) {
        nodes {
          id
          body
          createdAt
          user {
            name
            displayName
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`

const VIEW_ISSUE_NO_COMMENTS = `
  query ViewIssueNoComments($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
      priority
      estimate
      url
      branchName
      dueDate
      assignee {
        name
        displayName
      }
      state {
        name
        type
        color
      }
      labels {
        nodes {
          name
          color
        }
      }
      project {
        name
      }
      projectMilestone {
        name
      }
      cycle {
        name
        number
      }
      parent {
        identifier
        title
      }
      children(first: 100) {
        nodes {
          identifier
          title
          state {
            name
            type
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`

const CREATE_ISSUE = `
  mutation CreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        url
        title
      }
    }
  }
`

const UPDATE_ISSUE = `
  mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue {
        id
        identifier
        url
        title
      }
    }
  }
`

const SEARCH_ISSUES = `
  query SearchIssues($term: String!, $filter: IssueFilter, $first: Int) {
    searchIssues(term: $term, filter: $filter, first: $first) {
      nodes {
        id
        identifier
        title
        priority
        url
        assignee {
          name
          displayName
        }
        state {
          name
          type
          color
        }
        labels {
          nodes {
            name
            color
          }
        }
        updatedAt
      }
    }
  }
`

// Helper to resolve team key to team ID
const GET_TEAM_ID = `
  query GetTeamIdByKey($team: String!) {
    teams(filter: { key: { eq: $team } }) {
      nodes { id }
    }
  }
`

async function resolveTeamId(
  client: { request: (q: string, v?: Record<string, unknown>) => Promise<unknown> },
  teamKey: string,
): Promise<string> {
  const data = await client.request(GET_TEAM_ID, { team: teamKey.toUpperCase() })
  const nodes = (data as { teams: { nodes: Array<{ id: string }> } }).teams.nodes
  if (nodes.length === 0) {
    throw new Error(`Team "${teamKey}" not found`)
  }
  return nodes[0].id
}

export function registerIssueTools(registry: ToolRegistry): void {
  // linear_list_issues
  registry.register(
    {
      name: "linear_list_issues",
      description:
        "List issues for a team, optionally filtered by state, assignee, or project.",
      inputSchema: {
        type: "object",
        properties: {
          teamKey: {
            type: "string",
            description: "Team key (e.g. 'ENG', 'DES')",
          },
          state: {
            type: "string",
            description:
              "Filter by state type: triage, backlog, unstarted, started, completed, canceled",
          },
          assignee: {
            type: "string",
            description: "Filter by assignee display name (exact match)",
          },
          project: {
            type: "string",
            description: "Filter by project name (exact match)",
          },
          limit: {
            type: "number",
            description: "Maximum number of issues to return (default: 50)",
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
        const teamId = await resolveTeamId(client, args.teamKey as string)

        // Build filter
        const filter: Record<string, unknown> = {
          team: { id: { eq: teamId } },
        }
        if (args.state) {
          filter.state = { type: { eq: args.state } }
        }
        if (args.assignee) {
          filter.assignee = { displayName: { eqIgnoreCase: args.assignee as string } }
        }
        if (args.project) {
          filter.project = { name: { eq: args.project as string } }
        }

        const limit = (args.limit as number) || 50
        const data = await client.request(LIST_ISSUES, {
          filter,
          first: limit,
        })
        const issues = (data as { issues: { nodes: unknown[] } }).issues.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  // linear_view_issue
  registry.register(
    {
      name: "linear_view_issue",
      description:
        "Get full details of a single issue by its identifier (e.g. 'ENG-123') or UUID.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue identifier (e.g. 'ENG-123') or UUID",
          },
          includeComments: {
            type: "boolean",
            description: "Include comments in the response (default: true)",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["issueId"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)
        const includeComments = args.includeComments !== false
        const query = includeComments ? VIEW_ISSUE : VIEW_ISSUE_NO_COMMENTS
        const data = await client.request(query, { id: args.issueId as string })
        const issue = (data as { issue: unknown }).issue
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  // linear_create_issue
  registry.register(
    {
      name: "linear_create_issue",
      description: "Create a new issue in Linear.",
      inputSchema: {
        type: "object",
        properties: {
          teamKey: {
            type: "string",
            description: "Team key (e.g. 'ENG')",
          },
          title: {
            type: "string",
            description: "Issue title",
          },
          description: {
            type: "string",
            description: "Issue description (markdown)",
          },
          priority: {
            type: "number",
            description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low",
          },
          assignee: {
            type: "string",
            description:
              "Assignee user ID. Use 'self' to assign to the authenticated user.",
          },
          state: {
            type: "string",
            description: "Workflow state ID",
          },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "Array of label IDs",
          },
          project: {
            type: "string",
            description: "Project ID",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["teamKey", "title"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)
        const teamId = await resolveTeamId(client, args.teamKey as string)

        let assigneeId = args.assignee as string | undefined
        if (assigneeId === "self") {
          const viewerData = await client.request(
            `query { viewer { id } }`,
          )
          assigneeId = (viewerData as { viewer: { id: string } }).viewer.id
        }

        const input: Record<string, unknown> = {
          title: args.title,
          teamId,
        }
        if (args.description) input.description = args.description
        if (args.priority !== undefined) input.priority = args.priority
        if (assigneeId) input.assigneeId = assigneeId
        if (args.state) input.stateId = args.state
        if (args.labels) input.labelIds = args.labels
        if (args.project) input.projectId = args.project

        const data = await client.request(CREATE_ISSUE, { input })
        const result = (data as {
          issueCreate: { success: boolean; issue: unknown }
        }).issueCreate
        if (!result.success) {
          throw new Error("Issue creation failed")
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.issue, null, 2) },
          ],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  // linear_update_issue
  registry.register(
    {
      name: "linear_update_issue",
      description: "Update an existing issue in Linear.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue identifier (e.g. 'ENG-123') or UUID",
          },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description (markdown)" },
          priority: {
            type: "number",
            description: "Priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low",
          },
          assignee: {
            type: "string",
            description: "Assignee user ID, or 'self'",
          },
          state: { type: "string", description: "Workflow state ID" },
          labels: {
            type: "array",
            items: { type: "string" },
            description: "Array of label IDs (replaces existing)",
          },
          project: { type: "string", description: "Project ID" },
          workspace: { type: "string", description: "Workspace slug to target" },
        },
        required: ["issueId"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)

        let assigneeId = args.assignee as string | undefined
        if (assigneeId === "self") {
          const viewerData = await client.request(`query { viewer { id } }`)
          assigneeId = (viewerData as { viewer: { id: string } }).viewer.id
        }

        const input: Record<string, unknown> = {}
        if (args.title !== undefined) input.title = args.title
        if (args.description !== undefined) input.description = args.description
        if (args.priority !== undefined) input.priority = args.priority
        if (assigneeId) input.assigneeId = assigneeId
        if (args.state) input.stateId = args.state
        if (args.labels) input.labelIds = args.labels
        if (args.project) input.projectId = args.project

        const data = await client.request(UPDATE_ISSUE, {
          id: args.issueId as string,
          input,
        })
        const result = (data as {
          issueUpdate: { success: boolean; issue: unknown }
        }).issueUpdate
        if (!result.success) {
          throw new Error("Issue update failed")
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.issue, null, 2) },
          ],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  // linear_search_issues
  registry.register(
    {
      name: "linear_search_issues",
      description:
        "Search issues by text query across title, description, and comments.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term",
          },
          teamKey: {
            type: "string",
            description: "Optional team key to narrow search",
          },
          limit: {
            type: "number",
            description: "Maximum results (default: 20)",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["query"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)

        let filter: Record<string, unknown> | undefined
        if (args.teamKey) {
          const teamId = await resolveTeamId(client, args.teamKey as string)
          filter = { team: { id: { eq: teamId } } }
        }

        const limit = (args.limit as number) || 20
        const data = await client.request(SEARCH_ISSUES, {
          term: args.query as string,
          filter,
          first: limit,
        })
        const issues =
          (data as { searchIssues: { nodes: unknown[] } }).searchIssues.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
