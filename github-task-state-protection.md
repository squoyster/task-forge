How to Protect the task‑state Branch on GitHub

This guide provides step‑by‑step instructions for repository administrators to configure branch protection or rulesets for the task‑state branch.  The aim is to ensure that only validated changes reach the branch and that no automated agent can bypass safeguards.  These instructions must be performed manually in the GitHub web UI because branch protection cannot be automated via the Taskforge agent.

1. Create a branch protection rule

1. Navigate to the repository’s Settings and open the Code & automation → Branches section.
2. Under Branch protection rules, click Add rule.
3. Set Branch name pattern to task‑state.  This targets the specific branch that stores the task registry.
4. Configure the rule:
    * Require status checks to pass before merging – enable this and select the CI job that runs taskforge validate‑state so that PRs cannot be merged unless the state passes validation .  Optionally require branches to be up to date before merging to ensure that the latest code is tested.
    * Require pull request reviews – at least one approval is recommended to provide an additional human check on state changes.
    * Require linear history – enforce a linear commit history for easier auditing .
    * Require signed commits – optional but helps verify the author of each commit .
    * Restrict who can push to matching branches – enable this option and select only the recovery bot and designated human administrators .  This prevents implementer‑agent tokens from pushing directly to task‑state.
    * Lock branch – enabling “Lock branch” makes the branch read‑only outside of pull requests .  You can optionally allow fork syncing if external contributors need to sync their forks.
    * Do not allow bypassing the above settings – check this option to ensure that even admins cannot bypass the rule by default .
    * Disallow force pushes and deletions – leave the default settings that disable force pushes and branch deletion to preserve history .
5. Click Create to save the rule.

Note: Branch protection settings apply only to the selected branch.  For more information on the features available and who can manage them, see GitHub’s guide to protected branches .

2. Configure a push ruleset (optional)

If your repository is on a GitHub Team plan or higher, you can use a push ruleset to enforce file‑path restrictions across all branches:

1. Go to Settings → Code & automation → Rulesets.
2. Click New ruleset and select Push ruleset.
3. Add a file‑path restriction targeting task‑state/**/* so that pushes that modify any files in the task‑state directory are blocked .
4. Under Bypass list, add the recovery bot and human admins who should be able to bypass the rule.  Implementer agents and other contributors should not be added.
5. Enable the ruleset and click Save.  Rulesets layer with branch protection; the most restrictive rule applies .

3. Assign credentials appropriately

Ensure that service accounts and personal access tokens are scoped correctly:

* Implementer agents – should have permission to push code and normal branches but must not be able to push to task‑state.
* Recovery bot / GitHub App – holds the minimal permission required to push directly to task‑state for emergency fixes.  Use this credential only when the branch protection rule is temporarily relaxed.
* Human admin – retains full repository control to configure the protection rules and perform emergency recoveries.

Separate credentials reduce the blast radius if one token is compromised.

4. Verification

After setting up branch protection or rulesets:

1. Open a pull request that modifies the task‑state branch and verify that the task‑state validation status check appears and that the PR cannot be merged until it passes.
2. Attempt to push directly to the task‑state branch with an implementer token; it should be rejected.
3. Push a test commit to task‑state using the recovery bot (if configured) to ensure that authorised actors can still update the branch.
4. Periodically audit the branch protection settings to ensure that no new actors have been granted push permissions.

Properly configured branch protection ensures that task‑state remains a reliable source of truth and prevents agents or contributors from accidentally corrupting the task registry.
