> Status: Historical hardening draft. Use `docs/control-plane-hardening.md`, `docs/github-task-state-protection.md`, and `docs/workflow.md` for current operational guidance.

Never reuse tokens across tiers. Store secrets in GitHub Actions secrets and rotate them regularly.

Defence in depth

1. Implement CLI guardrails

Use taskforge validate‑state --strict --json (see § “Strict validation”) before any push to task‑state.  The CLI checks that the state directory contains valid JSON, that tasks are unique, and that required fields are present.  When --strict is set, the CLI must exit with a non‑zero code on warnings or errors, causing the workflow to fail.  Guardrails are cooperative – they rely on the user to run the command – so they must be enforced in CI and backed up by branch protection.

2. Add a CI validation workflow

Create a workflow (e.g. .github/workflows/task‑state‑validate.yml) that runs on pushes to pull requests touching the task‑state branch.  The job should:

1. Check out both the main repository and the task‑state branch.  Be careful with paths: by default, the CLI expects the state directory at ../task‑state.  Use actions/checkout with path: task‑state so that the state directory ends up at ../task‑state relative to the root of the main checkout.
2. Run npm ci or npm install to install dependencies.
3. Execute `taskforge validate-state --strict --json`. When the CLI exits non-zero, the job fails.
4. Optionally, upload a report artifact for visibility.

3. Protect the branch on GitHub

A branch protection rule prevents accidental or malicious pushes.  From the repository page go to Settings → Code & automation → Branches, add a rule targeting the task‑state branch, then configure the following options:

* Require status checks to pass before merging – enable this and select your validation job so that no PR can be merged unless the state passes validation.  Optionally require branches to be up to date before merging .
* Restrict who can push – limit pushes to a small set of actors such as the recovery bot and human admin .  Implementer‑agent tokens must not have this permission.
* Lock branch – make the branch read‑only to block all pushes and require PRs to merge .  Allow fork syncing if needed.
* Disallow bypassing settings – disable the “Do not allow bypassing the above settings” option to ensure even administrators cannot accidentally bypass the rule .
* Disallow force pushes and deletions – leave force pushes disabled and uncheck “Allow deletions” .  This prevents history rewrites and branch deletion.
* Require a linear history and signed commits – these optional rules make the history easier to audit.

Branch protection rules are only editable by repository admins; they cannot be created via API by an agent.  See GitHub’s documentation on protected branches .

4. Optional: use a push ruleset

GitHub rulesets offer finer‑grained control and can apply across forks.  A push ruleset can block pushes to any branch that modifies the task‑state directory.  In a Team plan or higher, create a ruleset targeting pushes and add a file path restriction on task‑state/**/* .  Then allow only the recovery bot or admin to bypass the rule.  Rulesets complement branch protection – they layer together and the most restrictive rule always applies .

5. Emergency recovery

If the state becomes corrupted or an urgent update is required, a human admin can temporarily allow the recovery bot to push directly to task‑state.  Steps:

1. Disable “Lock branch” or add the recovery bot to the list of allowed push actors.
2. Run taskforge validate‑state --json locally to verify the update.
3. Push the fix as the recovery bot.
4. Re‑enable branch restrictions immediately.
5. Conduct a post‑mortem to understand the failure and tighten controls.

Strict validation

taskforge validate‑state --strict should exit with a non‑zero status when there are any warnings or errors.  That behaviour ensures CI fails and branch protection rejects the merge.  Without strict mode the CLI prints warnings but exits with zero; this is not sufficient to protect the branch.  Implementers must update the CLI to support the --strict option and to treat warnings as failures when enabled.

Summary

* Use separate credentials for each role and never let implementer agents push to task‑state.
* Enforce validation in CI by running taskforge validate‑state --strict before merging state changes.
* Use branch protection rules to block direct pushes, require status checks, and restrict actors  .
* For additional control, consider a push ruleset that restricts changes to the task‑state directory .
* Reserve the ability to push directly to task‑state for a recovery bot or human administrator.

These measures provide defence in depth so that a misbehaving agent cannot corrupt the critical task‑state branch.
