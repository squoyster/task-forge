export {
  getOctokit,
  setConfig,
  getConfig,
  createIssue,
  updateIssueLabels,
  ensureLabels,
  updateIssueBody,
  generateIssueBody,
  getIssue,
} from "./service.js";

export type { GitHubConfig, IssueData, IssueResult } from "./types.js";
export { STATUS_LABELS, STATUS_COLORS } from "./types.js";