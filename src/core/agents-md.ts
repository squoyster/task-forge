import fs from "node:fs";
import path from "node:path";
import { replaceManagedBlock, writeGeneratedFile } from "../core/templates.js";
import { loadConfig } from "../core/config.js";
import { logInfo, logSuccess } from "../util/logging.js";

export function installAgentsMd(projectRoot: string, dryRun: boolean): void {
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const config = loadConfig(projectRoot);
  const policy = config.opencode.policy ?? "managed";

  const managedBlockContent = generateAgentsPolicyBlock(policy);

  if (fs.existsSync(agentsPath)) {
    const existing = fs.readFileSync(agentsPath, "utf-8");

    if (existing.includes("<!-- TASKFORGE:BEGIN managed-agent-policy -->") &&
        existing.includes(managedBlockContent)) {
      logInfo("AGENTS.md already has current managed policy block.");
      return;
    }

    if (dryRun) {
      logInfo(`AGENTS.md would be updated with managed policy block.`);
      return;
    }

    const updated = replaceManagedBlock(existing, "managed-agent-policy", managedBlockContent);
    fs.writeFileSync(agentsPath, updated, "utf-8");
    logSuccess("AGENTS.md updated with managed policy block.");
  } else {
    if (dryRun) {
      logInfo(`AGENTS.md would be created with managed policy block.`);
      return;
    }

    const content = generateFullAgentsMd(projectRoot, managedBlockContent);
    writeGeneratedFile(agentsPath, content);
    logSuccess("AGENTS.md created with managed policy block.");
  }
}

function generateAgentsPolicyBlock(policy: string): string {
  const policyLevel = policy === "permissive" ? "🔹 Permissive" :
    policy === "locked-down" ? "🔒 Locked-Down" : "🔹 Managed";

  return `## TaskForge Managed Policy (${policyLevel})

This repository is managed by TaskForge. All agents operating in this repository must follow these policies.

### Normal Agent Rules

- Use TaskForge lifecycle commands: \`taskforge start\`, \`taskforge done\`, \`taskforge checkpoint\`, \`taskforge submit\`
- Never run \`git\` directly (use \`taskforge diff\`, \`taskforge checkpoint\`, \`taskforge submit\` instead)
- Never edit files under \`../task-state/*.md\` directly
- Never edit legacy \`tasks/*.md\` files
- All task-state changes must flow through TaskForge CLI commands
- Do not edit \`.opencode/**\` or \`.taskforge/**\` unless role is doctor
- Stop all normal operations when \`.doctor-lock\` exists

### Doctor Mode Protocol

Doctor agents operate under elevated but constrained permissions:

- Run \`taskforge doctor --check\` first for diagnostics
- Acquire doctor lock: \`TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."\`
- Minimize direct task-state edits — prefer TaskForge commands
- Release doctor lock after repair: \`taskforge done\` on recovery task
- Never force push to main or task-state branches

### Allowed Normal Agent Commands

\`\`\`bash
taskforge next
taskforge start TASK-ID
taskforge heartbeat TASK-ID
taskforge inspect TASK-ID
taskforge diff TASK-ID
taskforge checkpoint TASK-ID --message "..."
taskforge submit TASK-ID
taskforge done TASK-ID
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge doctor --check
\`\`\``;
}

function generateFullAgentsMd(projectRoot: string, managedBlock: string): string {
  const projectName = path.basename(projectRoot);
  return `# AGENTS.md — ${projectName}

## TaskForge Agent Instructions

This file provides operational instructions for coding agents working on the ${projectName} project.

<!-- TASKFORGE:BEGIN managed-agent-policy -->
${managedBlock}
<!-- TASKFORGE:END managed-agent-policy -->
`;
}
