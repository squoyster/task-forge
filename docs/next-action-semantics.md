# Command Next-Action Semantics

TaskForge commands return structured next-command guidance that tells agents what to do next. This document enumerates summary-level `nextAction` values, their meanings, continuation rules, and expected follow-up commands. For the canonical command loop, see `docs/workflow.md`.

## Source

Next-action values are computed by `buildJson()` in `src/commands/summary.ts`. The priority cascade is evaluated in order — the first matching condition wins.

## Next-Action Values

| Priority | Condition | nextAction | Agent May Continue? | Follow-up Command |
|----------|-----------|------------|---------------------|-------------------|
| 1 | `In Progress` tasks exist | `Continue existing in-progress work.` | Yes — continue current task | `taskforge heartbeat <taskId>`, then work |
| 2 | `Verify` tasks exist | `Run QA/verification on tasks in Verify status.` | Yes — switch to QA role | `taskforge resume <taskId>`, then `taskforge gates --json` |
| 3 | `Review` tasks exist | `Review tasks in Review status.` | Yes — switch to reviewer role | `git diff <taskId>`, then `taskforge resume <taskId>` if edits are required |
| 4 | Scheduler selects a task | `Start the highest-priority task: <TASK-ID>` | Yes — claim and start | `taskforge start <taskId>` |
| 5 | `Needs Spec` tasks exist | `Create specs for tasks in Needs Spec.` | Yes — write specifications | `taskforge start <taskId>`, add ACs, `taskforge done <taskId>` |
| 6 | `Inbox` tasks exist | `Process inbox items into structured tasks.` | Yes — triage inbox | `taskforge next` to see recommendations, then `taskforge start <taskId>` |
| 7 | No actionable tasks | `No actionable tasks. Add work to the inbox.` | No — human intervention | `taskforge new "<title>"` to create work |

## Decision Flow

```
In Progress > 0  → continue work
Verify > 0       → run QA
Review > 0       → review code
Scheduler picks  → start new task
Needs Spec > 0   → write specs
Inbox > 0        → triage inbox
Nothing          → wait for human
```

## Agent Continuation Rules

- **In Progress**: The owning agent continues work. Other agents should not interrupt unless the task is stale (>4h without heartbeat), in which case the sweeper reclaims it.
- **Verify**: Any agent may pick up a Verify task. Use the QA agent role and resume the existing worktree; do not start a new task.
- **Review**: Any agent may pick up a Review task. Use the reviewer agent role and inspect the existing worktree; do not start a new task.
- **Scheduler pick**: The highest-scored Ready task is recommended. Use `taskforge start` to claim it.
- **Needs Spec**: Write clear, verifiable acceptance criteria. Mark Done when ACs are complete.
- **Inbox**: Convert raw inbox items into structured tasks with goal, ACs, and priority.
- **No actionable**: Stop and wait for human direction. Do not create speculative work.

## JSON Output

When `--json` is passed to `taskforge summary`, the response includes:

```json
{
  "generated": "2026-05-25 02:00:00",
  "total": 42,
  "byStatus": { "Ready": 5, "In Progress": 1, "Done": 30, ... },
  "nextAction": "Start the highest-priority task: TASK-042",
  "tasks": [...]
}
```

The `nextAction` field is human-readable. Agents should prefer the structured `validNextCommands` returned by `taskforge next --json` and only use `nextAction` as board-level context.

## Integration with `taskforge next`

`taskforge next` uses the same scheduler but returns a single task recommendation. The summary's `nextAction` provides broader context about the board state, while `next` gives a specific task to work on.

| Command | Returns | Use Case |
|---------|---------|----------|
| `taskforge summary` | Board state + nextAction string | Agent orientation, continuation decision |
| `taskforge next` | Single task ID + metadata + `validNextCommands` | Agent picks up specific work |
