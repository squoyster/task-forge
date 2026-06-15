---
id: TASK-306
type: Feature
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: fc3f15e832
claimed_at: '2026-06-15 20:50:44'
context_hash: 86c2d0ddbd80d3ed
spec_hash: eb442cb0f8ba6b72
branch: agent/TASK-306-add-branch-behind-validation-and-pr-auto--fc3f15e832
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-306
---

# TASK-306: Add Branch-Behind Validation and PR Auto-Creation to `taskforge submit`

## Goal

Augment the `taskforge submit` command so that before pushing a task branch, it validates that the branch is not behind `origin/main`, warns the user if a rebase is needed, and — after successful validation and push — automatically creates a GitHub pull request (when GitHub is configured). The command must also record `submitted_sha` in task frontmatter so that `completion-policy.ts` can verify SHA integrity at Done time.

This directly fulfills TASK-259 Acceptance Criteria #6 (ancestry validation) and #7 (unrelated-commit detection), and closes the gap where `submitted_sha` is never written to task state.

## Background

### Current State

1. **`cmdSubmit`** (`src/commands/git-facade.ts` line 238) runs `git push origin <branch>` with zero pre-push validation. It does not fetch `origin/main`, does not compare ancestry, and does not create a PR.
2. **`cmdPr`** (same file, line 271) is a separate command that creates a PR from the task branch to `main`. It hardcodes `"main"` as the base branch instead of reading the configured integration branch.
3. **`getBranchCommitsAhead`** exists in `src/core/git.ts` (line 111) but **`getBranchCommitsBehind`** does not exist. There is no function to check how many commits `origin/main` has that the task branch lacks.
4. **`submitted_sha`** is declared in the Zod task schema (`src/core/task.ts` line 76) but is **never written** after submission. `completion-policy.ts` (line 199–212) checks it and emits `NO_SUBMITTED_SHA` when it's absent, making the SHA-match precondition always fail for actual tasks.
5. **`createPullRequest`** is called from `cmdPr` with the hardcoded base `"main"` (line 311). It should use the configured integration branch (available from `config.integrationBranch` or defaulting to `"main"`).
6. **`submitStateMachine`** (`src/core/command-states.ts` line 654) does not have a condition for "push rejected due to non-fast-forward" or "branch is behind integration branch". It only reasons about `prCreated`, `prNumber`, `githubConfigured`, and `errorMessage`.

### Why This Matters

- TASK-259 AC #6 requires: "Submission validates that the branch's ancestry is consistent with recorded provenance."
- TASK-259 AC #7 requires: "Unrelated task commits are detected before submission."
- Without branch-behind checking, agents can submit branches that are based on stale main, creating merge conflicts or introducing regressions.
- Without recording `submitted_sha`, the completion gate cannot verify that the submitted code actually made it through the PR process.
- Currently, PR creation is a separate manual step (`taskforge pr`), which is fragile. Integrating PR creation into `submit` (with appropriate failure handling) streamlines the workflow.

## Scope

### Include
- `src/core/git.ts` — add `getBranchCommitsBehind()` function
- `src/commands/git-facade.ts` — modify `cmdSubmit()` to:
  - Fetch `origin/main` (or configured integration branch)
  - Compare merge-base of task branch vs `origin/<integration-branch>`
  - Determine if task branch is behind (warn + recommend rebase) or ahead (safe to proceed)
  - Detect unrelated commits that are not in the recorded base ancestry
  - Record `submitted_sha` in task frontmatter after successful push
  - After push, create a GitHub PR if GitHub is configured (previously `cmdPr`'s responsibility)
  - On PR creation failure, throw an error with `request_human_input` guidance
- `src/commands/git-facade.ts` — simplify or redirect `cmdPr()` (it can remain as a standalone command for manual use, but should use the configured integration branch instead of hardcoded `"main"`)
- `src/core/command-states.ts` — extend `submitStateMachine()` to handle new conditions: branch behind, unrelated commits detected, PR creation failure requiring human input
- `src/core/task-document.ts` — ensure `submitted_sha` and `submitted_at` are included in task document writes
- `tests/` — add unit/integration tests for the new `getBranchCommitsBehind`, the extended submit logic, and PR auto-creation

### Exclude
- General cleanup policy for stale local branches (out of scope)
- Automatic rebasing or merging — the command warns and stops, it does NOT auto-rebase
- Stacked-task mode changes (deferred to TASK-259 stacked-task work)
- Changing the GitHub integration service internals (`createPullRequest` API surface stays the same)
- Modifying the done/precondition verification flow in `completion-policy.ts` (it already handles `submitted_sha` checking)

## Acceptance Criteria

1. **`getBranchCommitsBehind(repoRoot, branch)`** is added to `src/core/git.ts` and returns the count of commits on `origin/<integration-branch>` that are not reachable from the given branch.
2. Before pushing, `cmdSubmit` fetches `origin/<integration-branch>` and calls both `getBranchCommitsAhead` and `getBranchCommitsBehind` to assess divergence.
3. If the task branch is **behind** the integration branch (behind > 0), the command:
   - Outputs a clear warning listing how many commits behind
   - Suggests rebasing: `git rebase origin/<integration-branch>`
   - Returns `"branch_behind"` error code with `nextAction: "request_human_input"` to prevent blind push
4. If the task branch has **unrelated commits** (commits that are not descendants of the recorded base SHA from TASK-259's provenance metadata), the command detects and warns, rejecting the push.
5. If the task branch is **ahead** (normal case), the command proceeds to push.
6. After a successful push, the command records the pushed SHA as `submitted_sha` and the current timestamp as `submitted_at` in the task file's frontmatter.
7. After recording state, if GitHub is configured (`config.github.enabled`), `cmdSubmit` auto-creates a PR using the configured integration branch as base (not hardcoded `"main"`).
8. If PR creation fails, the command stops with a `request_human_input` next action, preserving the already-recorded `submitted_sha`.
9. If GitHub is not configured, the command logs instructions for manual PR creation (current `cmdPr` non-GitHub behavior) and succeeds — the user can create the PR manually.
10. The `cmdPr` standalone command is updated to read the configured integration branch instead of hardcoding `"main"`.
11. All existing tests in `tests/commands/git-facade.test.ts` (or equivalent) continue to pass.

## Required Tests

### Unit Tests (in `tests/core/git.test.ts` or equivalent)
- `getBranchCommitsBehind` returns 0 when branch is up to date
- `getBranchCommitsBehind` returns correct count when branch is behind
- `getBranchCommitsBehind` returns 0 when remote branch doesn't exist
- `getBranchCommitsBehind` handles detached HEAD gracefully

### Integration Tests (in `tests/commands/` or equivalent)
- Submit with up-to-date branch → succeeds, SHA recorded, PR created (if GitHub configured)
- Submit with behind branch → fails with `branch_behind` error, no push, no state change
- Submit with unrelated commits → fails with `unrelated_commits` error
- Submit with GitHub configured but PR creation failing → push succeeds, SHA recorded, human intervention requested
- Submit without GitHub configured → push succeeds, SHA recorded, manual PR instructions shown
- `cmdPr` uses configured integration branch, not hardcoded `"main"`

## Test / Verification Command

```bash
# Unit tests for the new function
npm test -- --run tests/core/git.test.ts 2>&1 | grep -E "(PASS|FAIL|getBranchCommitsBehind)"

# Integration tests for submit
npm test -- --run tests/git-facade.test.ts 2>&1 | grep -E "(PASS|FAIL|submit|behind|unrelated)"

# Type check
npm run typecheck

# Build
npm run build

# Manual validation (after unit tests pass):
# 1. Create a test branch behind main → verify submit rejects
# 2. Create a test branch ahead of main → verify submit succeeds
# 3. Verify submitted_sha appears in task frontmatter after submit
```

## Dependencies

- **TASK-259**: This task implements AC #6 and #7 of TASK-259. TASK-259 must first establish the branch provenance metadata (base SHA, base branch, branch creation SHA) that this task's validation reads. Specifically, `task.start` must record `base_sha` and `branch_creation_sha` before submit can validate against them.
- The configured integration branch name must be accessible via `config.integrationBranch` (falls back to `"main"`).

## Risk Level

**Medium**

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Aggressive validation blocks legitimate submits if detection logic is buggy | Lost productivity | Thorough test coverage; error messaging always includes recovery steps |
| PR auto-creation fails after push already happened | Orphan pushed branch + recorded SHA but no PR | Handle PR failure gracefully: keep the SHA, log clear instructions to create PR manually, request human input |
| Config integration branch differs from `"main"` in some repos | Wrong comparison target | Read `config.integrationBranch` explicitly with `"main"` as default; `cmdPr` already uses `"main"` hardcoded — fix both |
| `getBranchCommitsBehind` has different semantics than `git rev-list --count` on some edge cases (e.g., force-pushed remote) | False positives/negatives | Use the same `execa` pattern as `getBranchCommitsAhead` for consistency; test with force-pushed remote |

## Human Intervention Required

**No** — for the happy path. The AC explicitly requires `request_human_input` when PR creation fails after a successful push, but that's a runtime state, not a pre-requisite.

## Continuation Policy

Auto-continue unless:
- Validation finds the branch is behind `origin/<integration-branch>` (behind > 0) — stop and wait for rebase
- Unrelated commits are detected in branch ancestry — stop and request human input
- PR auto-creation fails after push — stop and request human input

## Agent Notes

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-306

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-306
- Session: fc3f15e832
- Branch: agent/TASK-306-add-branch-behind-validation-and-pr-auto--fc3f15e832

### Implementation Guidance

1. **Add `getBranchCommitsBehind` in `src/core/git.ts`:**
   - Mirror the pattern of `getBranchCommitsAhead` (line 111–119).
   - Use `execa("git", ["rev-list", "--count", "${branch}..origin/${integrationBranch}"], ...)`.
   - Return 0 on error or missing remote.

2. **Extend `submitStateMachine` in `src/core/command-states.ts`:**
   - Add new state conditions: `branchBehind`, `unrelatedCommits`, `prCreationFailed`.
   - Map `branchBehind` → `"request_human_input"` with guidance to rebase.
   - Map `unrelatedCommits` → `"request_human_input"`.
   - Keep existing `prCreated`/`githubConfigured` logic for the post-push PR flow.

3. **Modify `cmdSubmit` in `src/commands/git-facade.ts`:**
   - After ownership/validity checks, read the integration branch from config.
   - `git fetch origin <integrationBranch>`.
   - Compute `behindCount` via `getBranchCommitsBehind`.
   - If `behindCount > 0`: warn, emit `branch_behind` error, return early (no push).
   - If unrelated commits detected (compare branch ancestry against recorded `base_sha` from task frontmatter): warn, emit `unrelated_commits` error, return early.
   - Push (existing logic).
   - After successful push, write `submitted_sha` (current HEAD SHA) and `submitted_at` (ISO timestamp) to the task file.
   - If GitHub configured, call `createPullRequest` with the correct integration branch as base.
   - If PR creation fails, emit error with `request_human_input` guidance (but SHA is already recorded — intentional).

4. **Update `cmdPr` in `src/commands/git-facade.ts`:**
   - Replace hardcoded `"main"` (line 311) with `config.integrationBranch ?? "main"`.

5. **Tests:** Cover all acceptance criteria with at minimum unit tests for the git function and integration tests for the submit flow.

