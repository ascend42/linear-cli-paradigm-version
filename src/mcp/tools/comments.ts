import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const LIST_COMMENTS = `
  query ListComments($id: String!) {
    issue(id: $id) {
      comments(first: 50, orderBy: createdAt) {
        nodes {
          id
          body
          createdAt
          updatedAt
          url
          user {
            name
            displayName
          }
          parent {
            id
          }
        }
      }
    }
  }
`

const ADD_COMMENT = `
  mutation AddComment($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment {
        id
        body
        createdAt
        url
        user {
          name
          displayName
        }
      }
    }
  }
`

export function registerCommentTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_comments",
      description: "List comments on an issue.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue identifier (e.g. 'ENG-123') or UUID",
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
        const data = await client.request(LIST_COMMENTS, {
          id: args.issueId as string,
        })
        const comments = (
          data as { issue: { comments: { nodes: unknown[] } } }
        ).issue.comments.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(comments, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  registry.register(
    {
      name: "linear_add_comment",
      description: "Add a comment to an issue.",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue identifier (e.g. 'ENG-123') or UUID",
          },
          body: {
            type: "string",
            description: "Comment body (markdown)",
          },
          parentCommentId: {
            type: "string",
            description: "Parent comment ID for threading (optional)",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["issueId", "body"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)

        const input: Record<string, unknown> = {
          issueId: args.issueId as string,
          body: args.body as string,
        }
        if (args.parentCommentId) {
          input.parentId = args.parentCommentId as string
        }

        const data = await client.request(ADD_COMMENT, { input })
        const result = (
          data as {
            commentCreate: { success: boolean; comment: unknown }
          }
        ).commentCreate
        if (!result.success) {
          throw new Error("Comment creation failed")
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(result.comment, null, 2) },
          ],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
