---
id: TASK-001
source: main/tasks
---

# TASK-001: Implement New `next` Command Workflow
## Goal
Implement a new `next` command workflow that automates the process of selecting and claiming the next best task from the backlog.

## Background
The current task selection process can be manual. We want to automate it using a series of steps: listing tasks, inspecting open ones, claiming the best available, and optionally creating a new task if a documentation gap is identified.

## Scope
### Allowed Files
- `src/core/task-store.ts`
- `src/commands/next.ts` (if exists, or create)
- `docs/architecture/`
- `.agent/tf.ctx`
- `.agent/spec.idx`

### Disallowed Files
- `node_modules/`
- `session-*.md`
- Files larger than 600 characters for output (respect `max-output=600`)
- Large `.md` files (respect `no-large-md`)

## Acceptance Criteria
- The `next` command executes the following workflow:
  1. `tf-list`
  2. `inspect-top-open`
  3. `claim-start-best`
  4. `if-none:create-from-doc-gap`
- The command validates the following for each task:
  - Check for duplicates.
  - Check if the task is blocked.
  - Verify owner and lease status.
  - Verify acceptance criteria.
  - Check `next-action`.
- The command outputs:
  - `selected`: The ID of the selected task.
  - `commands`: The list of commands executed.
  - `state`: The current state of the workflow.
  - `next-edit`: The suggested next edit.
  - `created`: The ID of any new task created (if any).
- The command respects the following constraints:
  - `no-large-md`
  - `no-session-md`
  - `no-node_modules`
  - `max-output=600`

## Test / Verification Command
`tf next` (Verify output contains the required fields and workflow steps were followed)

## Expected Output / Behavior
Describe expected result.

## Dependencies
- `src/core/task-store.ts`

## Risks
Known risks.

## Continuation Policy
If the task is blocked or a duplicate is found, the workflow should skip to the next available task until a valid one is found or the limit is reached.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:

## Risk Level and Risks
- **Risk**: High risk of selecting a blocked or already-claimed task if logic is flawed.
- **Mitigation**: Implement strict checks for `blocked` and `assignee` status before claiming.

## Human Intervention Required
- Required if the `create-from-doc-gap` step fails to find a clear documentation gap.
