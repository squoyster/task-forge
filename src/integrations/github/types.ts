export interface GitHubConfig {
  owner: string;
  repo: string;
  token?: string;
}

export interface IssueData {
  title: string;
  body: string;
  labels: string[];
}

export interface IssueResult {
  number: number;
  url: string;
}

export const STATUS_LABELS: Record<string, string> = {
  "Inbox": "inbox",
  "Needs Spec": "needs-spec",
  "Ready": "ready",
  "In Progress": "in-progress",
  "Blocked": "blocked",
  "Review": "review",
  "Verify": "verify",
  "Done": "done",
  "Rejected": "rejected",
  "Deferred": "deferred",
};

export const STATUS_COLORS: Record<string, string> = {
  inbox: "d4c5f9",
  "needs-spec": "fef2c0",
  ready: "0e8a16",
  "in-progress": "fbca04",
  blocked: "e11d21",
  review: "1d76db",
  verify: "006b75",
  done: "0e8a16",
  rejected: "e11d21",
  deferred: "d4c5f9",
};