import { ClientError } from "graphql-request"

/**
 * MCP-safe error response shape.
 */
export interface McpErrorResult {
  content: Array<{ type: "text"; text: string }>
  isError: true
}

/**
 * Extract a user-friendly message from a GraphQL ClientError.
 */
function extractMessage(error: ClientError): string {
  const extensions = error.response?.errors?.[0]?.extensions
  const userMessage = extensions?.userPresentableMessage as string | undefined
  if (userMessage) return userMessage

  const firstError = error.response?.errors?.[0]
  if (firstError?.message) return firstError.message

  return error.message
}

/**
 * Convert any error into an MCP-safe error response.
 * MCP tools must never throw — all errors are returned as { isError: true }.
 */
export function formatError(error: unknown): McpErrorResult {
  let message: string

  if (error instanceof ClientError) {
    message = extractMessage(error)
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = String(error)
  }

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  }
}
