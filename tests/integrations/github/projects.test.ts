import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Octokit from service
vi.mock("../../../src/integrations/github/service.js", () => ({
  getOctokit: vi.fn(),
  setConfig: vi.fn(),
  getConfig: vi.fn(),
}));

import { getOctokit } from "../../../src/integrations/github/service.js";
import {
  getProjectNodeId,
  getIssueNodeId,
  getStatusFieldInfo,
  findProjectItemId,
  addProjectItem,
  updateItemStatus,
  syncTaskToProject,
} from "../../../src/integrations/github/projects.js";

function mockOctokitGraphql<T>(result: T): void {
  vi.mocked(getOctokit).mockReturnValue({
    graphql: vi.fn().mockResolvedValue(result),
  } as any);
}

function mockOctokitGraphqlError(message: string): void {
  vi.mocked(getOctokit).mockReturnValue({
    graphql: vi.fn().mockRejectedValue(new Error(message)),
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProjectNodeId", () => {
  it("returns project ID for valid owner and number", async () => {
    mockOctokitGraphql({
      organization: {
        projectV2: { id: "PVT_kwDOAABA" },
      },
    });

    const result = await getProjectNodeId("test-owner", 1);
    expect(result).toBe("PVT_kwDOAABA");
  });

  it("returns null when project is not found", async () => {
    mockOctokitGraphql({
      organization: {
        projectV2: null,
      },
    });

    const result = await getProjectNodeId("test-owner", 999);
    expect(result).toBeNull();
  });

  it("returns null on GraphQL error", async () => {
    mockOctokitGraphqlError("API error");

    const result = await getProjectNodeId("test-owner", 1);
    expect(result).toBeNull();
  });
});

describe("getIssueNodeId", () => {
  it("returns issue node ID for valid issue", async () => {
    mockOctokitGraphql({
      repository: {
        issue: { id: "I_kwDOAABA" },
      },
    });

    const result = await getIssueNodeId("test-owner", "test-repo", 42);
    expect(result).toBe("I_kwDOAABA");
  });

  it("returns null on error", async () => {
    mockOctokitGraphqlError("API error");

    const result = await getIssueNodeId("test-owner", "test-repo", 42);
    expect(result).toBeNull();
  });
});

describe("getStatusFieldInfo", () => {
  it("returns field and option IDs for valid field and status", async () => {
    mockOctokitGraphql({
      node: {
        fields: {
          nodes: [
            { id: "field1", name: "Title", dataType: "TEXT" },
            {
              id: "field2",
              name: "Status",
              dataType: "SINGLE_SELECT",
              options: [
                { id: "opt_todo", name: "Todo" },
                { id: "opt_in_progress", name: "In Progress" },
                { id: "opt_done", name: "Done" },
              ],
            },
          ],
        },
      },
    });

    const result = await getStatusFieldInfo("project-id", "Status", "In Progress");
    expect(result).toEqual({ fieldId: "field2", optionId: "opt_in_progress" });
  });

  it("returns null when field is not found", async () => {
    mockOctokitGraphql({
      node: {
        fields: {
          nodes: [
            { id: "field1", name: "Title", dataType: "TEXT" },
          ],
        },
      },
    });

    const result = await getStatusFieldInfo("project-id", "Status", "Todo");
    expect(result).toBeNull();
  });

  it("returns null when option is not found", async () => {
    mockOctokitGraphql({
      node: {
        fields: {
          nodes: [
            {
              id: "field2",
              name: "Status",
              dataType: "SINGLE_SELECT",
              options: [
                { id: "opt_todo", name: "Todo" },
                { id: "opt_done", name: "Done" },
              ],
            },
          ],
        },
      },
    });

    const result = await getStatusFieldInfo("project-id", "Status", "In Progress");
    expect(result).toBeNull();
  });

  it("returns null on GraphQL error", async () => {
    mockOctokitGraphqlError("API error");

    const result = await getStatusFieldInfo("project-id", "Status", "Todo");
    expect(result).toBeNull();
  });
});

describe("findProjectItemId", () => {
  it("returns item ID when content matches", async () => {
    mockOctokitGraphql({
      node: {
        items: {
          nodes: [
            { id: "item1", content: { __typename: "Issue", id: "issue1" } },
            { id: "item2", content: { __typename: "Issue", id: "issue2" } },
          ],
        },
      },
    });

    const result = await findProjectItemId("project-id", "issue2");
    expect(result).toBe("item2");
  });

  it("returns null when no matching content", async () => {
    mockOctokitGraphql({
      node: {
        items: {
          nodes: [
            { id: "item1", content: { __typename: "Issue", id: "issue1" } },
          ],
        },
      },
    });

    const result = await findProjectItemId("project-id", "issue-unknown");
    expect(result).toBeNull();
  });
});

describe("addProjectItem", () => {
  it("returns new item ID on success", async () => {
    mockOctokitGraphql({
      addProjectV2ItemById: {
        item: { id: "new-item-id" },
      },
    });

    const result = await addProjectItem("project-id", "content-id");
    expect(result).toBe("new-item-id");
  });

  it("returns null on GraphQL error", async () => {
    mockOctokitGraphqlError("API error");

    const result = await addProjectItem("project-id", "content-id");
    expect(result).toBeNull();
  });
});

describe("updateItemStatus", () => {
  it("returns true on success", async () => {
    mockOctokitGraphql({
      updateProjectV2ItemFieldValue: {
        projectV2Item: { id: "item-id" },
      },
    });

    const result = await updateItemStatus("project-id", "item-id", "field-id", "option-id");
    expect(result).toBe(true);
  });

  it("returns false on GraphQL error", async () => {
    mockOctokitGraphqlError("API error");

    const result = await updateItemStatus("project-id", "item-id", "field-id", "option-id");
    expect(result).toBe(false);
  });
});

describe("syncTaskToProject", () => {
  it("returns true when no project number is configured", async () => {
    const result = await syncTaskToProject(
      { owner: "test", repo: "test" },
      42,
      "Done",
      "Status",
    );
    expect(result).toBe(true);
  });

  it("completes full sync flow successfully", async () => {
    const mockGraphql = vi.fn()
      // getProjectNodeId
      .mockResolvedValueOnce({
        organization: { projectV2: { id: "project-id" } },
      })
      // getIssueNodeId
      .mockResolvedValueOnce({
        repository: { issue: { id: "issue-id" } },
      })
      // getStatusFieldInfo
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                id: "field-id",
                name: "Status",
                dataType: "SINGLE_SELECT",
                options: [
                  { id: "opt-done", name: "Done" },
                ],
              },
            ],
          },
        },
      })
      // findProjectItemId — found, no add needed
      .mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              { id: "existing-item", content: { __typename: "Issue", id: "issue-id" } },
            ],
          },
        },
      })
      // updateItemStatus
      .mockResolvedValueOnce({
        updateProjectV2ItemFieldValue: {
          projectV2Item: { id: "existing-item" },
        },
      });

    vi.mocked(getOctokit).mockReturnValue({
      graphql: mockGraphql,
    } as any);

    const result = await syncTaskToProject(
      { owner: "test-owner", repo: "test-repo", projectNumber: 1 },
      42,
      "Done",
      "Status",
    );
    expect(result).toBe(true);
    expect(mockGraphql).toHaveBeenCalledTimes(5);
  });

  it("adds item when not found in project", async () => {
    const mockGraphql = vi.fn()
      // getProjectNodeId
      .mockResolvedValueOnce({
        organization: { projectV2: { id: "project-id" } },
      })
      // getIssueNodeId
      .mockResolvedValueOnce({
        repository: { issue: { id: "issue-id" } },
      })
      // getStatusFieldInfo
      .mockResolvedValueOnce({
        node: {
          fields: {
            nodes: [
              {
                id: "field-id",
                name: "Status",
                dataType: "SINGLE_SELECT",
                options: [
                  { id: "opt-todo", name: "Todo" },
                ],
              },
            ],
          },
        },
      })
      // findProjectItemId — not found
      .mockResolvedValueOnce({
        node: {
          items: { nodes: [] },
        },
      })
      // addProjectItem
      .mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: { id: "new-item" },
        },
      })
      // updateItemStatus
      .mockResolvedValueOnce({
        updateProjectV2ItemFieldValue: {
          projectV2Item: { id: "new-item" },
        },
      });

    vi.mocked(getOctokit).mockReturnValue({
      graphql: mockGraphql,
    } as any);

    const result = await syncTaskToProject(
      { owner: "test-owner", repo: "test-repo", projectNumber: 1 },
      42,
      "Todo",
      "Status",
    );
    expect(result).toBe(true);
    expect(mockGraphql).toHaveBeenCalledTimes(6);
  });

  it("returns false when project is not found", async () => {
    vi.mocked(getOctokit).mockReturnValue({
      graphql: vi.fn().mockResolvedValue({
        organization: { projectV2: null },
      }),
    } as any);

    const result = await syncTaskToProject(
      { owner: "test-owner", repo: "test-repo", projectNumber: 999 },
      42,
      "Todo",
      "Status",
    );
    expect(result).toBe(false);
  });
});
