import type { ToolRegistry } from "../registry.ts"
import { getClientForWorkspace } from "../client-factory.ts"
import { formatError } from "../error-handler.ts"

const LIST_DOCUMENTS = `
  query ListDocuments($filter: DocumentFilter, $first: Int) {
    documents(filter: $filter, first: $first) {
      nodes {
        id
        title
        slugId
        url
        updatedAt
        project {
          name
          slugId
        }
        creator {
          name
        }
      }
    }
  }
`

const VIEW_DOCUMENT = `
  query ViewDocument($id: String!) {
    document(id: $id) {
      id
      title
      slugId
      content
      url
      createdAt
      updatedAt
      creator {
        name
      }
      project {
        name
        slugId
      }
    }
  }
`

export function registerDocumentTools(registry: ToolRegistry): void {
  registry.register(
    {
      name: "linear_list_documents",
      description: "List documents, optionally filtered by project.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Filter by project ID",
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
        if (args.project) {
          filter.project = { id: { eq: args.project as string } }
        }

        const limit = (args.limit as number) || 50
        const data = await client.request(LIST_DOCUMENTS, {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: limit,
        })
        const documents =
          (data as { documents: { nodes: unknown[] } }).documents.nodes
        return {
          content: [{ type: "text", text: JSON.stringify(documents, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )

  registry.register(
    {
      name: "linear_view_document",
      description:
        "Get full document details including markdown content by ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Document UUID or slug ID",
          },
          workspace: {
            type: "string",
            description: "Workspace slug to target",
          },
        },
        required: ["id"],
      },
    },
    async (args) => {
      try {
        const client = getClientForWorkspace(args.workspace as string | undefined)
        const data = await client.request(VIEW_DOCUMENT, {
          id: args.id as string,
        })
        const doc = (data as { document: unknown }).document
        return {
          content: [{ type: "text", text: JSON.stringify(doc, null, 2) }],
        }
      } catch (error) {
        return formatError(error)
      }
    },
  )
}
