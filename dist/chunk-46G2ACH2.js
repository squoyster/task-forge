// src/util/paths.ts
import path from "path";
import { execSync } from "child_process";
var _repoRoot = null;
function getRepoRoot() {
  if (!_repoRoot) {
    _repoRoot = discoverRepoRoot();
  }
  return _repoRoot;
}
function discoverRepoRoot() {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      cwd: process.cwd()
    }).trim();
    return root;
  } catch {
    return process.cwd();
  }
}
function getMainRepoRoot(repoRoot) {
  try {
    const gitDir = execSync("git rev-parse --git-common-dir", {
      encoding: "utf-8",
      cwd: repoRoot
    }).trim();
    return path.resolve(repoRoot, gitDir, "..");
  } catch {
    return repoRoot;
  }
}
function getTaskStateDir(repoRoot) {
  return path.resolve(getMainRepoRoot(repoRoot), "..", "task-state");
}
function getTaskFilePath(repoRoot, id) {
  return path.join(getTaskStateDir(repoRoot), `${id}.md`);
}
function getWorktreesDir(repoRoot) {
  const repoName = path.basename(repoRoot);
  return path.resolve(repoRoot, "..", "worktrees", repoName);
}
function getWorktreePath(repoRoot, id) {
  return path.join(getWorktreesDir(repoRoot), id);
}
function getTaskforgeDir(repoRoot) {
  return path.join(repoRoot, ".taskforge");
}
function getConfigJsonPath(repoRoot) {
  return path.join(getTaskforgeDir(repoRoot), "config.json");
}
function makeBranchName(id, title, sessionId) {
  const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 40).replace(/-$/, "");
  const suffix = slug ? `-${slug}` : "";
  const sessionSuffix = sessionId ? `--${sessionId}` : "";
  return `agent/${id}${suffix}${sessionSuffix}`;
}

export {
  getRepoRoot,
  getTaskStateDir,
  getTaskFilePath,
  getWorktreePath,
  getTaskforgeDir,
  getConfigJsonPath,
  makeBranchName
};
//# sourceMappingURL=chunk-46G2ACH2.js.map