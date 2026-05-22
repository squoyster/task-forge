import { getOctokit } from "./service.js";
import type { GitHubConfig } from "./types.js";
import { logError } from "../../util/logging.js";

/**
 * GraphQL response fragments for Projects v2.
 */
interface ProjectV2FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ProjectV2FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ProjectV2FieldsResponse {
  node?: {
    fields: {
      nodes: ProjectV2FieldNode[];
    };
  };
}

interface ProjectV2ItemsResponse {
  node?: {
    items: {
      nodes: Array<{
        id: string;
        content: { __typename: string; id: string } | null;
      }>;
    };
  };
}

interface AddItemResponse {
  addProjectV2ItemById: {
    item: { id: string };
  };
}

interface UpdateFieldResponse {
  updateProjectV2ItemFieldValue: {
    projectV2Item: { id: string };
  };
}

interface IssueNodeIdResponse {
  repository: {
    issue: { id: string };
  };
}

/**
 * Execute a GraphQL query against GitHub API v4.
 */
async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const octokit = getOctokit();
  const response = await octokit.graphql<T>(query, variables);
  return response;
}

/**
 * Get the project node ID from owner and project number.
 */
export async function getProjectNodeId(
  owner: string,
  projectNumber: number,
): Promise<string | null> {
  const query = `
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
        }
      }
    }
  `;

  try {
    const result = await graphql<{
      organization?: { projectV2: { id: string } | null };
    }>(query, { owner, number: projectNumber });

    if (!result.organization?.projectV2) {
      logError(`Project #${projectNumber} not found for ${owner}`);
      return null;
    }
    return result.organization.projectV2.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to find project #${projectNumber}: ${msg}`);
    return null;
  }
}

/**
 * Get the node ID of a GitHub Issue by repo owner, repo name, and issue number.
 */
export async function getIssueNodeId(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string | null> {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;

  try {
    const result = await graphql<IssueNodeIdResponse>(query, {
      owner,
      repo,
      number: issueNumber,
    });
    return result.repository?.issue?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to get node ID for issue #${issueNumber}: ${msg}`);
    return null;
  }
}

/**
 * Find the field ID and option ID for a given status field name and value.
 * Returns { fieldId, optionId } if found, or null.
 */
export async function getStatusFieldInfo(
  projectId: string,
  fieldName: string,
  statusValue: string,
): Promise<{ fieldId: string; optionId: string } | null> {
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await graphql<ProjectV2FieldsResponse>(query, {
      projectId,
    });

    const fields = result.node?.fields?.nodes ?? [];
    const field = fields.find((f) => f.name === fieldName && f.dataType === "SINGLE_SELECT");

    if (!field) {
      logError(`Status field "${fieldName}" not found in project.`);
      return null;
    }

    const option = field.options?.find(
      (o) => o.name.toLowerCase() === statusValue.toLowerCase(),
    );

    if (!option) {
      logError(
        `Status option "${statusValue}" not found in field "${fieldName}". Available: ${field.options?.map((o) => o.name).join(", ") ?? "none"}`,
      );
      return null;
    }

    return { fieldId: field.id, optionId: option.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to query project fields: ${msg}`);
    return null;
  }
}

/**
 * Find the project item ID for a given content (issue) node ID.
 * Returns the project item node ID if found, or null.
 */
export async function findProjectItemId(
  projectId: string,
  contentId: string,
): Promise<string | null> {
  const query = `
    query($projectId: ID!, $contentId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await graphql<ProjectV2ItemsResponse>(query, {
      projectId,
      contentId,
    });

    const items = result.node?.items?.nodes ?? [];
    const match = items.find(
      (item) => item.content?.id === contentId,
    );
    return match?.id ?? null;
  } catch {
    // Silently skip — item may not exist yet
    return null;
  }
}

/**
 * Add a content node (issue) to a project board.
 * Returns the new project item ID, or null on failure.
 */
export async function addProjectItem(
  projectId: string,
  contentId: string,
): Promise<string | null> {
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;

  try {
    const result = await graphql<AddItemResponse>(mutation, {
      projectId,
      contentId,
    });
    return result.addProjectV2ItemById?.item?.id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to add item to project: ${msg}`);
    return null;
  }
}

/**
 * Update the status field value for a project item.
 */
export async function updateItemStatus(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<boolean> {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item { id }
      }
    }
  `;

  try {
    await graphql<UpdateFieldResponse>(mutation, {
      projectId,
      itemId,
      fieldId,
      optionId,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`Failed to update item status: ${msg}`);
    return false;
  }
}

/**
 * High-level function: ensure a task's linked issue is on the project board
 * with the correct status column.
 *
 * Returns true if sync succeeded, false otherwise.
 */
export async function syncTaskToProject(
  config: GitHubConfig & { projectNumber?: number },
  issueNumber: number,
  taskStatus: string,
  fieldName: string,
): Promise<boolean> {
  if (!config.projectNumber) {
    // No project configured — this is not an error
    return true;
  }

  // 1. Get project node ID
  const projectId = await getProjectNodeId(config.owner, config.projectNumber);
  if (!projectId) return false;

  // 2. Get issue node ID
  const contentId = await getIssueNodeId(
    config.owner,
    config.repo,
    issueNumber,
  );
  if (!contentId) return false;

  // 3. Get field and option IDs
  const fieldInfo = await getStatusFieldInfo(projectId, fieldName, taskStatus);
  if (!fieldInfo) return false;

  // 4. Find existing project item (idempotency)
  let itemId = await findProjectItemId(projectId, contentId);

  // 5. If not found, add it to the project
  if (!itemId) {
    itemId = await addProjectItem(projectId, contentId);
    if (!itemId) return false;
  }

  // 6. Update status field
  return await updateItemStatus(projectId, itemId, fieldInfo.fieldId, fieldInfo.optionId);
}
