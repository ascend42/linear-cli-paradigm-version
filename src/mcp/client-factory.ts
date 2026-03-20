import { GraphQLClient } from "graphql-request"
import {
  getCredentialApiKey,
  getDefaultWorkspace,
  getWorkspaces,
} from "../credentials.ts"
import { LINEAR_API_ENDPOINT } from "../const.ts"
import denoConfig from "../../deno.json" with { type: "json" }

/**
 * Get the GraphQL endpoint URL.
 */
function getGraphQLEndpoint(): string {
  return Deno.env.get("LINEAR_GRAPHQL_ENDPOINT") || LINEAR_API_ENDPOINT
}

/**
 * Create a workspace-aware GraphQL client.
 * If workspace is omitted, uses the default workspace from credentials.
 * Throws if no API key is found for the specified workspace.
 */
export function getClientForWorkspace(workspace?: string): GraphQLClient {
  // Check env var first
  const envApiKey = Deno.env.get("LINEAR_API_KEY")
  if (envApiKey && !workspace) {
    return new GraphQLClient(getGraphQLEndpoint(), {
      headers: {
        Authorization: envApiKey,
        "User-Agent": `linear-cli-mcp/${denoConfig.version}`,
      },
    })
  }

  const apiKey = getCredentialApiKey(workspace)
  if (!apiKey) {
    const target = workspace ?? getDefaultWorkspace() ?? "(no default)"
    throw new Error(
      `No API key found for workspace "${target}". Run \`linear auth login\` to authenticate.`,
    )
  }

  return new GraphQLClient(getGraphQLEndpoint(), {
    headers: {
      Authorization: apiKey,
      "User-Agent": `linear-cli-mcp/${denoConfig.version}`,
    },
  })
}

/**
 * Get workspace metadata for introspection tools.
 */
export function getWorkspaceInfo(): {
  workspaces: string[]
  defaultWorkspace: string | undefined
} {
  return {
    workspaces: getWorkspaces(),
    defaultWorkspace: getDefaultWorkspace(),
  }
}
