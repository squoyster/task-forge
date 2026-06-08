import { Octokit } from "@octokit/rest";
import type { GitHubConfig, IssueData, IssueResult } from "./types.js";
import { STATUS_LABELS, STATUS_COLORS } from "./types.js";

const LABEL_NAMES = ["taskforge", ...Object.values(STATUS_LABELS)];

let _octokit: Octokit | null = null;
let _config: GitHubConfig | null = null;

export function getOctokit(): Octokit {
  if (!_octokit) {
    const token = process.env.GITHUB_TOKEN;
    _octokit = new Octokit(token ? { auth: token } : {});
  }
  return _octokit;
}

export function setConfig(config: GitHubConfig): void {
  _config = config;
  _octokit = null;

  if (config.token) {
    _octokit = new Octokit({ auth: config.token });
  }
}

export function getConfig(): GitHubConfig | null {
  return _config;
}

export async function createIssue(
  config: GitHubConfig,
  data: IssueData,
): Promise<IssueResult> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();
  const response = await octokit.issues.create({
    owner: config.owner,
    repo: config.repo,
    title: data.title,
    body: data.body,
    labels: data.labels,
  });
  return { number: response.data.number, url: response.data.html_url };
}

export async function updateIssueLabels(
  config: GitHubConfig,
  issueNumber: number,
  newStatusLabel: string,
): Promise<void> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  const { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
  });

  const statusLabelValues = Object.values(STATUS_LABELS);
  const nonStatusLabels = currentLabels
    .filter((l) => !statusLabelValues.includes(l.name))
    .map((l) => l.name)
    .filter((name): name is string => name !== undefined);

  const newLabels = [...nonStatusLabels, newStatusLabel];

  await octokit.issues.setLabels({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    labels: newLabels,
  });
}

export async function ensureLabels(config: GitHubConfig): Promise<void> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  let existingLabels: Set<string>;
  try {
    const { data } = await octokit.issues.listLabelsForRepo({
      owner: config.owner,
      repo: config.repo,
      per_page: 100,
    });
    existingLabels = new Set(data.map((l) => l.name));
  } catch {
    existingLabels = new Set();
  }

  for (const name of LABEL_NAMES) {
    if (existingLabels.has(name)) continue;

    const color = name === "taskforge" ? "0052cc" : STATUS_COLORS[name] ?? "ededed";

    try {
      await octokit.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name,
        color,
      });
    } catch {
      // Label creation may fail due to permissions; skip
    }
  }
}

export async function updateIssueBody(
  config: GitHubConfig,
  issueNumber: number,
  body: string,
): Promise<void> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  await octokit.issues.update({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    body,
  });
}

export function generateIssueBody(id: string, taskBody: string): string {
  return `## TaskForge Task: ${id}

This issue is managed by TaskForge Autonomous Coding Board.

**Do not edit this issue directly.** Changes should be made to the task file in \`tasks/${id}.md\`.

---

${taskBody}
`;
}

export async function getIssue(
  config: GitHubConfig,
  issueNumber: number,
): Promise<{ title: string; state: string; labels: string[] } | null> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  try {
    const { data } = await octokit.issues.get({
      owner: config.owner,
      repo: config.repo,
      issue_number: issueNumber,
    });
    return {
      title: data.title,
      state: data.state,
      labels: data.labels
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter((name): name is string => name !== undefined),
    };
  } catch {
    return null;
  }
}

export interface PullRequestResult {
  number: number;
  url: string;
}

/**
 * Find a pull request by head branch. Returns null if not found.
 * Used for idempotent submission — re-running submit should not
 * create a duplicate PR.
 */
export async function findPullRequestByBranch(
  config: GitHubConfig,
  head: string,
): Promise<PullRequestResult | null> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  try {
    const { data } = await octokit.pulls.list({
      owner: config.owner,
      repo: config.repo,
      head: `${config.owner}:${head}`,
      state: "all",
      per_page: 10,
    });

    // Return the first open PR for this branch, or the first closed one
    if (data.length === 0) return null;

    const openPr = data.find((pr) => pr.state === "open");
    if (openPr) {
      return { number: openPr.number, url: openPr.html_url };
    }

    // No open PR — return the most recent closed one
    const closed = data[0];
    return { number: closed.number, url: closed.html_url };
  } catch {
    return null;
  }
}

export async function createPullRequest(
  config: GitHubConfig,
  title: string,
  head: string,
  base: string,
  body: string,
): Promise<PullRequestResult> {
  const octokit = config.token ? new Octokit({ auth: config.token }) : getOctokit();

  const response = await octokit.pulls.create({
    owner: config.owner,
    repo: config.repo,
    title,
    head,
    base,
    body,
  });

  return {
    number: response.data.number,
    url: response.data.html_url,
  };
}