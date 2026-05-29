# Agentic Task Prompt: Fix `claim → start` Self-Deadlock and Remove Agent-Facing Force Guidance

## Task Title

Fix TaskForge claim/start self-deadlock and enforce human/doctor-only force operations

## Recommended Task Creation Command

```bash
taskforge new "Fix claim/start self-deadlock and remove agent-facing force guidance" \
  --type Bug \
  --priority P0 \
  --status Ready \
  --agent-role Implementer \
  --body "$(cat docs/prompts/fix-claim-start-self-deadlock.md)"
```

If this prompt is not already committed into the repo, create the task manually using this Markdown as the task body.

---

## Diagnostic Summary

TaskForge currently has a workflow contract bug.

Observed behavior:

```text
taskforge next
→ recommends taskforge start TASK-ID

but agents may also run:
taskforge claim TASK-ID
→ claim locks the task
→ claim tells the agent to run taskforge start TASK-ID
→ start refuses because the task is already assigned
```

Root cause:

```text
claim is not a lightweight advisory command.
claim mutates task-state:
- sets assignee
- sets claimed_at
- moves Ready → In Progress
- attempts to create a worktree

But start rejects any already-assigned task unless --force is used.
Since --force must be human/doctor-only, this creates an invalid agent path.
```

The likely failure is **not** that `taskforge next` is locking the task. `next` appears read-mostly except for sweeper recovery. The self-deadlock is caused by `claim` locking the task and then emitting guidance that points to `start`.

---

## Required Policy

Normal agents must use this primary workflow:

```bash
taskforge next
taskforge start TASK-ID
cd <worktree>
taskforge prompt TASK-ID
# implement
taskforge checkpoint TASK-ID -m "..."
taskforge gates
taskforge submit TASK-ID
taskforge pr TASK-ID
taskforge done TASK-ID
```

Normal agents must **not** use this workflow:

```bash
taskforge claim TASK-ID
taskforge start TASK-ID
```

Normal agents must never invoke:

```bash
taskforge * --force
git checkout
git branch
git push
git merge
git worktree
```

except through TaskForge façade commands.

`--force` is reserved for:

```text
- human_override
- doctor_mode
```

---

## Scope

Fix the command guidance and state-machine behavior so agents cannot be guided into a TaskForge-invalid path.

This is a control-plane correctness task. Do not make unrelated architecture changes.

---

## Files to Inspect

Start with:

```text
src/commands/next.ts
src/commands/claim.ts
src/commands/start.ts
src/core/command-states.ts
src/core/task-state-transaction.ts
src/core/session.ts
src/core/authority.ts
src/core/errors.ts
src/util/json-result.ts
README.md
TASKFORGE.md
```

Relevant implementation observations:

```text
cmdNext:
- pulls task-state
- runs sweeper
- selects next task
- emits guidance to run taskforge start TASK-ID
- should remain read-only except for sweeper recovery

cmdClaim:
- pulls task-state
- runs sweeper
- calls tx.claimTask(taskId, sessionId)
- claimTask sets assignee, claimed_at, and Ready → In Progress
- claim attempts to create a worktree
- claim currently emits guidance that can point agents toward start

cmdStart:
- rejects task.assignee unless --force is passed
- currently treats any existing assignment as a conflict
- should not recommend --force to normal agents
```

---

## Required Design Decision

Adopt this behavior:

```text
next → start is the normal agent path.

claim is not part of the normal implementation path.
claim is either:
1. internal/advanced coordination, or
2. human/doctor/recovery-oriented.

If claim succeeds and creates a worktree, the next valid agent action is to enter/resume the worktree, not to run start.
```

---

## Required Implementation Changes

### 1. Update `claimStateMachine()`

Current problem:

```text
claim success guidance says:
Run 'taskforge start TASK-ID' to create the worktree and begin work.
```

Replace with guidance based on actual outcome.

If claim succeeded and worktree exists:

```text
COMMAND STATUS: success
STATE: task_claimed
VALID NEXT COMMANDS:
- cd <worktree>
- taskforge prompt TASK-ID
- taskforge inspect TASK-ID
- taskforge heartbeat TASK-ID

FORBIDDEN COMMANDS:
- taskforge start TASK-ID
- taskforge start TASK-ID --force
```

If claim succeeded but worktree creation failed:

```text
COMMAND STATUS: partial_success
STATE: task_claimed_workspace_failed
VALID NEXT COMMANDS:
- taskforge doctor --json
- taskforge inspect TASK-ID --json
- taskforge block TASK-ID "Claim succeeded but worktree creation failed" --category unsafe_operation --blocked-by human --json

FORBIDDEN COMMANDS:
- taskforge start TASK-ID --force
- raw git worktree repair by agent
```

Do not recommend `claim --force`.

---

### 2. Update `cmdClaim()` output

`cmdClaim()` must not emit:

```text
Run 'taskforge start TASK-ID' to create the worktree.
```

Instead:

If worktree exists:

```text
Valid next commands:
1. cd <worktree>
2. taskforge prompt TASK-ID
3. taskforge inspect TASK-ID
```

If worktree creation failed after claim succeeded:

```text
Valid next commands:
1. taskforge doctor --json
2. taskforge inspect TASK-ID --json
3. taskforge block TASK-ID "Claim succeeded but worktree creation failed" --category unsafe_operation --blocked-by human
```

---

### 3. Update `cmdStart()` already-assigned failure

Current behavior recommends `--force`.

Replace agent-facing guidance with:

```text
COMMAND STATUS: failure
ERROR CODE: ALREADY_ASSIGNED
STATE: already_assigned

The task is already assigned. Normal agents may not use --force.

VALID NEXT COMMANDS:
- taskforge resume TASK-ID
- taskforge inspect TASK-ID --json
- taskforge doctor --json
- taskforge block TASK-ID "Task already assigned; human or doctor recovery required" --category unsafe_operation --blocked-by human --json

FORBIDDEN COMMANDS:
- taskforge start TASK-ID --force
- taskforge unlock TASK-ID --force
- raw git checkout / branch / worktree operations
```

Important: do not include `--force` in normal valid next commands.

---

### 4. Update `startStateMachine()`

Remove any guidance that says:

```text
Use 'taskforge start TASK-ID --force'
```

Replace with doctor/human escalation:

```text
Task is assigned to another session.

Normal agents must not override claims.

Valid next commands:
- taskforge resume TASK-ID
- taskforge inspect TASK-ID --json
- taskforge doctor --json
- taskforge block TASK-ID "Already assigned; override requires human or doctor authority" --category unsafe_operation --blocked-by human --json
```

---

### 5. Update `assertTaskOwnership()`

Current ownership mismatch guidance may point to:

```text
taskforge unlock TASK-ID --force
```

Replace with:

```text
Ownership mismatch.

Normal agents must not use force unlock.

Valid next commands:
- taskforge inspect TASK-ID --json
- taskforge doctor --json
- taskforge block TASK-ID "Ownership mismatch requires human or doctor recovery" --category unsafe_operation --blocked-by human --json
```

---

### 6. Ensure return templates are command-contract compliant

Every affected command result must include:

```yaml
commandStatus: success | partial_success | failure
state: <machine_state>
taskId: <TASK-ID if applicable>
validNextCommands:
  - command: <taskforge command or cd command>
    reason: <why this is valid>
    safety: safe | requires_human | doctor_only
forbiddenCommands:
  - command: <forbidden command>
    reason: <why forbidden>
todoMerge:
  required: true
  instruction: >
    Merge all listed todo items into the current task todo before continuing.
contextCleanup:
  required: <true when starting/switching tasks>
  instruction: >
    Before starting a new task, clean stale context. Preserve only relevant prior context by converting it into explicit todo items.
agentInstruction: >
  Execute only one of the validNextCommands. Do not invent alternate commands.
```

For `start` success, `contextCleanup.required` must be `true`.

For `next` success selecting a task, `contextCleanup.required` should be `true` for the subsequent `start` transition.

---

## Required Tests

Add or update tests to cover these cases.

### Test 1: `next` does not claim

Given:

```text
TASK-001 status Ready with no assignee
```

When:

```bash
taskforge next --json
```

Then:

```text
- output recommends taskforge start TASK-001
- task remains Ready
- task has no assignee
- task has no claimed_at
```

### Test 2: `claim` does not recommend `start`

Given:

```text
TASK-001 status Ready
```

When:

```bash
taskforge claim TASK-001 --json
```

Then:

```text
- task becomes In Progress
- task has assignee
- output does not include taskforge start TASK-001
- output does not include any --force command
- output includes cd <worktree> or doctor/block guidance if worktree failed
```

### Test 3: `claim → start` failure does not recommend force

Given:

```text
TASK-001 was claimed successfully
```

When:

```bash
taskforge start TASK-001 --json
```

Then:

```text
- command fails with ALREADY_ASSIGNED or equivalent
- validNextCommands do not include --force
- guidance includes resume, inspect, doctor, or block
```

### Test 4: Assigned task recovery guidance is TaskForge-only

Given:

```text
TASK-001 assigned to another session
```

When:

```bash
taskforge start TASK-001 --json
```

Then output must not contain:

```text
git checkout
git branch
git push
git merge
git worktree
--force
```

Except `--force` may appear only in `forbiddenCommands`, never in `validNextCommands`.

### Test 5: Ownership mismatch does not recommend force unlock

Given an ownership mismatch:

```text
current branch session != task assignee
```

Then the error guidance must recommend:

```text
taskforge inspect
taskforge doctor
taskforge block
```

and must not recommend:

```text
taskforge unlock --force
```

---

## Documentation Updates

Update docs to state:

```text
Normal agent workflow:
next → start → prompt/resume → checkpoint → gates → submit/pr → done

claim is not part of normal implementation flow.
claim is advanced/recovery/coordination only unless explicitly returned as a valid next command.
--force is human/doctor-only.
```

Update at minimum:

```text
README.md
TASKFORGE.md
docs/agent-framework-integration.md, if present and relevant
any command-return-template docs, if present
```

---

## Acceptance Criteria

- [ ] `taskforge next --json` recommends `taskforge start TASK-ID`.
- [ ] `taskforge next --json` does not mutate selected task state except via sweeper recovery of stale unrelated tasks.
- [ ] `taskforge claim TASK-ID --json` never recommends `taskforge start TASK-ID`.
- [ ] `taskforge claim TASK-ID --json` never recommends any `--force` command as valid.
- [ ] `taskforge start TASK-ID --json` on an already-assigned task never recommends `--force`.
- [ ] `taskforge start TASK-ID --json` on an already-assigned task recommends only TaskForge-safe recovery commands.
- [ ] `assertTaskOwnership()` errors do not recommend `unlock --force` to normal agents.
- [ ] Agent-facing guidance never instructs raw git operations except through TaskForge git façade commands.
- [ ] New tests cover `next`, `claim`, `claim → start`, assigned-task start failure, and ownership mismatch.
- [ ] Documentation clearly defines `next → start` as the normal path.
- [ ] Documentation clearly defines `--force` as human/doctor-only.
- [ ] Command return payloads include success/failure status, valid next commands, todo merge instruction, and context cleanup instruction where applicable.

---

## Non-Goals

Do not:

```text
- make raw git acceptable for agents
- add broad new workflow concepts
- let agents use --force
- bypass task-state branch
- remove doctor mode
- weaken locking semantics
- mark claimed tasks as unassigned just to make start pass
```

---

## Final Agent Instruction

Implement this as a narrow P0 control-plane correctness fix.

Preserve the central invariant:

```text
Agents must only proceed through explicitly returned valid TaskForge commands.
If no valid TaskForge command can resolve the state, block the task or enter doctor/human recovery.
Never invent raw git workarounds.
```
