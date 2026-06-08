import { STATUS } from "../../util/status-constants.js";

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
  [STATUS.INBOX]: "inbox",
  [STATUS.NEEDS_SPEC]: "needs-spec",
  [STATUS.READY]: "ready",
  [STATUS.IN_PROGRESS]: "in-progress",
  [STATUS.BLOCKED]: "blocked",
  [STATUS.IMPLEMENTATION_COMPLETE]: "impl-complete",
  [STATUS.SUBMITTED]: "submitted",
  [STATUS.REVIEW]: "review",
  [STATUS.MERGE_READY]: "merge-ready",
  [STATUS.VERIFY]: "verify",
  [STATUS.DONE]: "done",
  [STATUS.REJECTED]: "rejected",
  [STATUS.DEFERRED]: "deferred",
};

export const STATUS_COLORS: Record<string, string> = {
  inbox: "d4c5f9",
  "needs-spec": "fef2c0",
  ready: "0e8a16",
  "in-progress": "fbca04",
  blocked: "e11d21",
  "impl-complete": "c5def5",
  submitted: "bfdadc",
  review: "1d76db",
  "merge-ready": "0e8a16",
  verify: "006b75",
  done: "0e8a16",
  rejected: "e11d21",
  deferred: "d4c5f9",
};