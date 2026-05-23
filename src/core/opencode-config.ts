import fs from "node:fs";
import path from "node:path";
import { logInfo, logSuccess } from "../util/logging.js";
import type { GeneratedFilePlan } from "../agent-frameworks/types.js";

export interface OpenCodePermissions {
  [key: string]: unknown;
}

export function generateOpenCodeConfig(policy: string, audit: boolean, guard: boolean): Record<string, unknown> {
  const config: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    taskforge: {
      managed: true,
      policyVersion: 1,
    },
    permission: {
      "*": "ask",
      edit: {
        "*": "allow",
        "../task-state/**": "deny",
        "tasks/**": "deny",
        ".git/**": "deny",
        "../worktrees/**/.git/**": "deny",
      },
      bash: {
        "*": "ask",
        "pwd": "allow",
        "ls *": "allow",
        "cat *": "allow",
        "rg *": "allow",
        "grep *": "allow",
        "find *": "allow",
        "npm install": "ask",
        "npm run *": "allow",
        "npm test *": "allow",
        "taskforge *": "allow",
        "npm run dev -- *": "allow",
        "git *": "deny",
        "sed *../task-state*": "deny",
        "perl *../task-state*": "deny",
        "python *../task-state*": "deny",
        "node *../task-state*": "deny",
        "tee *../task-state*": "deny",
        "echo *../task-state*": "deny",
        "rm *../task-state*": "deny",
        "mv *../task-state*": "deny",
        "cp *../task-state*": "deny",
      },
      external_directory: {
        "../task-state/**": "allow",
        "../worktrees/**": "allow",
      },
    },
    agent: {
      doctor: {
        permission: {
          bash: {
            "taskforge doctor *": "allow",
            "taskforge inspect *": "allow",
            "taskforge audit *": "allow",
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
          },
        },
      },
    },
  };

  if (audit) {
    config.taskforge = { ...config.taskforge as Record<string, unknown>, audit: true };
  }
  if (guard) {
    config.taskforge = { ...config.taskforge as Record<string, unknown>, guard: true };
  }

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
    if (key === "taskforge") {
      result.taskforge = { ...result.taskforge as Record<string, unknown>, ...(value as Record<string, unknown>) };
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
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
