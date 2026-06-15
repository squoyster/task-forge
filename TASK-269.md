---
id: TASK-269
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: afaaead0c5e2939d
---

# TASK-269: Fix shell escaping in taskforge new --body

## Goal

Fix the `taskforge new --body` option so that special characters (backticks, quotes, dollars signs) in the body text are not interpreted by the shell.

## Problem

When running `taskforge new TITLE --body "text with `backticks` or $dollars"`, the shell interprets backticks as command substitution and dollar signs as variable expansion before the text reaches the Node.js CLI. This corrupts the task body and can lead to malformed task files.

## Task Description

The `--body` option accepts a string that gets written into the task file's body section. When that string contains shell-special characters, the current implementation relies on the user properly escaping them. Instead, the CLI should:
  1. Accept body content from stdin (pipe or redirect)
  2. Accept a `--body-file <path>` option that reads from a file
  3. Suggest these alternatives in help text when `--body` contains suspicious patterns

## Acceptance Criteria

1. `taskforge new TITLE --body <text>` still works for simple text (no breaking change).
2. `taskforge new TITLE --body-file /path/to/file` reads body content from a file.
3. `echo "body text" | taskforge new TITLE -` (or `--body-stdin`) reads from stdin.
4. Help text for `--body` mentions the `--body-file` and stdin alternatives for complex content.
5. All three methods produce identical task files (same frontmatter, same body).
6. Existing tests still pass (no regressions).

## Required Tests

- `--body-file` reads content from file.
- stdin pipe produces the same result as `--body`.
- Body with backticks survives round-trip via `--body-file` and stdin.
- Help output mentions `--body-file` and stdin.
- `--body` continues to work as before.

## Completion Evidence

- Updated `new.ts` with `--body-file` and/or stdin support.
- Tests passing.
- Manual verification: `echo '## Test\n- backtick: `ls`' | taskforge new "test" -`

## Acceptance Criteria

- [ ]

## Agent Notes
