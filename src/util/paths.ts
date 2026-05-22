import path from "node:path";

let _repoRoot: string | null = null;

export function getRepoRoot(): string {
  if (!_repoRoot) {
    _repoRoot = process.cwd();
  }
  return _repoRoot;
}

export function setRepoRoot(root: string): void {
  _repoRoot = root;
}

export function getTasksDir(repoRoot: string): string {
  return path.join(repoRoot, "tasks");
}

export function getTaskStateDir(repoRoot: string): string {
  return path.resolve(repoRoot, "..", "task-state");
}

export function getTaskFilePath(repoRoot: string, id: string): string {
  return path.join(getTaskStateDir(repoRoot), `${id}.md`);
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

export function makeBranchName(id: string, title: string, sessionId?: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");
  const suffix = slug ? `-${slug}` : "";
  const sessionSuffix = sessionId ? `--${sessionId}` : "";
  return `agent/${id}${suffix}${sessionSuffix}`;
}
