import fs from "node:fs";
import path from "node:path";
import { logInfo, logSuccess } from "../util/logging.js";

export interface OpenCodePermissions {
  [key: string]: unknown;
}

export function generateOpenCodeConfig(_policy: string, _audit: boolean, _guard: boolean): Record<string, unknown> {
  // Least-privilege role profiles (TF-SIMP-06). Mirrors checked-in opencode.json.
  // Hard denies (.git/**, tasks/**, git push --force*) appear at BOTH global and
  // implementer level so they survive regardless of agent-permission merge semantics.
  const config: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    default_agent: "implementer",
    agent: {
      implementer: {
        description: "Implements one task at a time in isolated worktrees",
        mode: "primary",
        env: { TASK_FORGE_ACTIVE: "true" },
        permission: {
          edit: { "*": "allow", ".git/**": "deny", "tasks/**": "deny", "dist/**": "deny" },
          bash: {
            "*": "ask",
            "git status *": "allow",
            "git diff *": "allow",
            "git log *": "allow",
            "git show *": "allow",
            "git add *": "allow",
            "git commit *": "allow",
            "git push *": "allow",
            "git push --force*": "deny",
            "git checkout *": "allow",
            "git branch *": "allow",
            "git switch *": "allow",
            "git fetch *": "allow",
            "git worktree *": "allow",
            "git merge *": "allow",
            "git rebase *": "allow",
            "git stash *": "allow",
            "npm run *": "allow",
            "npm test *": "allow",
            "npm install": "ask",
            "node *": "allow",
            "npx *": "allow",
            "rg *": "allow",
            "taskforge *": "allow",
          },
        },
      },
      planner: {
        description: "Decomposes epics and features into executable tasks",
        mode: "subagent",
        permission: { edit: "deny", bash: { "*": "ask", "rg *": "allow", "taskforge inspect *": "allow", "taskforge list *": "allow", "taskforge next *": "allow" } },
      },
      reviewer: {
        description: "Reviews code for correctness, security, and scope compliance",
        mode: "subagent",
        permission: { edit: "deny", bash: { "*": "ask", "git diff *": "allow", "git log *": "allow", "git show *": "allow", "rg *": "allow", "taskforge inspect *": "allow" } },
      },
      doctor: {
        description: "Diagnoses and repairs TaskForge state under an explicit recovery allowlist",
        mode: "primary",
        permission: {
          edit: { "*": "deny", "../task-state/**": "allow" },
          bash: {
            "taskforge doctor *": "allow",
            "taskforge inspect *": "allow",
            "taskforge audit *": "allow",
            "taskforge validate-state *": "allow",
            "taskforge agents *": "allow",
            "taskforge unlock *": "allow",
            "git status *": "allow",
            "git diff *": "allow",
            "git log *": "allow",
            "git show *": "allow",
            "git fetch *": "allow",
            "git pull *": "ask",
            "git commit *": "ask",
            "git push *": "ask",
            "git reset *": "ask",
            "git rebase *": "ask",
            "git push --force*": "deny",
            "*": "deny",
          },
        },
      },
    },
    mcp: {
      taskforge: { type: "local", command: ["taskforge", "mcp", "--config", ".taskforge/config.json"], enabled: false },
    },
    permission: {
      "*": "ask",
      edit: { "*": "ask", ".git/**": "deny", "tasks/**": "deny" },
      bash: { "*": "ask", "git push --force*": "deny" },
      webfetch: "allow",
      external_directory: { "../task-state/**": "allow", "../worktrees/**": "allow" },
    },
  };

  return config;
}

export function installOpenCodeConfig(projectRoot: string, policy: string, audit: boolean, guard: boolean, dryRun: boolean): void {
  const configPath = path.join(projectRoot, "opencode.json");

  if (fs.existsSync(configPath)) {
    const existing = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;

    const newConfig = generateOpenCodeConfig(policy, audit, guard);
    const merged = mergeConfig(existing, newConfig);

    if (dryRun) {
      logInfo("opencode.json would be merged with TaskForge-managed permissions.");
      return;
    }

    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8");
    logSuccess("opencode.json merged with TaskForge-managed permissions.");
  } else {
    if (dryRun) {
      logInfo("opencode.json would be created with TaskForge-managed permissions.");
      return;
    }

    const config = generateOpenCodeConfig(policy, audit, guard);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    logSuccess("opencode.json created with TaskForge-managed permissions.");
  }
}

export function mergeConfig(existing: Record<string, unknown>, generated: Record<string, unknown>): Record<string, unknown> {
  const result = { ...existing };

  for (const [key, value] of Object.entries(generated)) {
    if (key === "$schema") continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] as Record<string, unknown> ?? {}, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function deepMerge(existing: Record<string, unknown>, generated: Record<string, unknown>): Record<string, unknown> {
  const result = { ...existing };
  for (const [key, value] of Object.entries(generated)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value) &&
        typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
