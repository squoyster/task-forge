import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot(startDir: string): string {
  let current = startDir;
  while (current !== path.parse(current).root) {
    if (
      fs.existsSync(path.join(current, "package.json")) ||
      fs.existsSync(path.join(current, "TASKFORGE.md")) ||
      fs.existsSync(path.join(current, ".git"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return startDir;
}

let _repoRoot: string | null = null;

export function getRepoRoot(): string {
  if (!_repoRoot) {
    _repoRoot = findRepoRoot(__dirname);
  }
  return _repoRoot;
}

export function getTasksDir(repoRoot: string): string {
  return path.join(repoRoot, "tasks");
}

export function getTaskFilePath(repoRoot: string, id: string): string {
  return path.join(getTasksDir(repoRoot), `${id}.md`);
}

export function getWorktreesDir(repoRoot: string): string {
  return path.resolve(repoRoot, "..", "worktrees");
}

export function getWorktreePath(repoRoot: string, id: string): string {
  return path.join(getWorktreesDir(repoRoot), id);
}

export function getTaskforgeDir(repoRoot: string): string {
  return path.join(repoRoot, ".taskforge");
}

export function getCachePath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "cache.json");
}

export function getConfigPath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "config.yaml");
}

export function getConfigJsonPath(repoRoot: string): string {
  return path.join(getTaskforgeDir(repoRoot), "config.json");
}

export function makeBranchName(id: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");
  return `agent/${id}-${slug}`;
}
