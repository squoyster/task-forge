import {
  logInfo,
  logSuccess
} from "./chunk-OPCWHN3N.js";

// src/core/opencode-config.ts
import fs from "fs";
import path from "path";
function generateOpenCodeConfig(_policy, _audit, _guard) {
  const config = {
    $schema: "https://opencode.ai/config.json",
    permission: {
      "*": "ask",
      edit: {
        "*": "allow",
        "../task-state/**": "deny",
        "tasks/**": "deny",
        ".git/**": "deny",
        "../worktrees/**/.git/**": "deny"
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
        "cp *../task-state*": "deny"
      },
      external_directory: {
        "../task-state/**": "allow",
        "../worktrees/**": "allow"
      }
    },
    agent: {
      implementer: {
        env: {
          TASK_FORGE_ACTIVE: "true"
        }
      },
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
            "git push --force*": "deny"
          }
        }
      }
    }
  };
  return config;
}
function installOpenCodeConfig(projectRoot, policy, audit, guard, dryRun) {
  const configPath = path.join(projectRoot, "opencode.json");
  if (fs.existsSync(configPath)) {
    const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
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
function mergeConfig(existing, generated) {
  const result = { ...existing };
  for (const [key, value] of Object.entries(generated)) {
    if (key === "$schema") continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] ?? {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
function deepMerge(existing, generated) {
  const result = { ...existing };
  for (const [key, value] of Object.entries(generated)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export {
  generateOpenCodeConfig,
  installOpenCodeConfig,
  mergeConfig
};
//# sourceMappingURL=chunk-F6MGWUO6.js.map