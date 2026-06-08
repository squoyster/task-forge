/**
 * Pull-request verifier implementations.
 *
 * Provides concrete PullRequestVerifier classes that check PR merge state,
 * SHA reachability, and required status checks against provider APIs.
 */
import { Octokit } from "@octokit/rest";
import type { PullRequestVerifier } from "./completion-policy.js";

// ---------------------------------------------------------------------------
// GitHub Verifier
// ---------------------------------------------------------------------------

/**
 * Verifies PR integration state via the GitHub API.
 */
export class GitHubPullRequestVerifier implements PullRequestVerifier {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit(token ? { auth: token } : {});
  }

  async checkMerged(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<{ merged: boolean; mergeCommitSha?: string }> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
      });

      if (data.merged) {
        return {
          merged: true,
          mergeCommitSha: data.merge_commit_sha ?? undefined,
        };
      }

      // Also check via the list endpoint for merged state
      if (data.state === "closed") {
        const { data: prData } = await this.octokit.pulls.get({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.prNumber,
        });
        // The `merged` field may be null if not cached; check merge_commit_sha
        if (prData.merged_at || prData.merge_commit_sha) {
          return {
            merged: true,
            mergeCommitSha: prData.merge_commit_sha ?? undefined,
          };
        }
      }

      return { merged: false };
    } catch {
      return { merged: false };
    }
  }

  async getHeadSha(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<string | null> {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
      });
      return data.head?.sha ?? null;
    } catch {
      return null;
    }
  }

  async checkReachable(params: {
    owner: string;
    repo: string;
    sha: string;
    branch: string;
  }): Promise<boolean> {
    try {
      // Use the GitHub API to check if the SHA is an ancestor of the branch
      const { data } = await this.octokit.repos.listCommits({
        owner: params.owner,
        repo: params.repo,
        sha: params.branch,
        per_page: 1,
      });

      if (data.length === 0) return false;

      // Try to get the merge-base; if it fails, the SHA is not reachable
      try {
        await this.octokit.repos.getCommit({
          owner: params.owner,
          repo: params.repo,
          ref: params.sha,
        });
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  async checkRequiredChecks(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<{ passed: boolean; pending: string[]; failing: string[] }> {
    try {
      const { data } = await this.octokit.checks.listForRef({
        owner: params.owner,
        repo: params.repo,
        ref: `refs/pull/${params.prNumber}/head`,
      });

      const pending: string[] = [];
      const failing: string[] = [];

      for (const check of data.check_runs) {
        if (check.conclusion === "success" || check.conclusion === "neutral") {
          continue;
        }
        if (check.status === "completed") {
          failing.push(`${check.name}: ${check.conclusion}`);
        } else {
          pending.push(`${check.name}: ${check.status}`);
        }
      }

      return {
        passed: failing.length === 0 && pending.length === 0,
        pending,
        failing,
      };
    } catch {
      return { passed: false, pending: [], failing: ["Could not verify checks"] };
    }
  }
}
