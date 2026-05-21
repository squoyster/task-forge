import { runOutdated, type OutdatedPackage } from "./outdated.js";
import { loadConfig } from "../../core/config.js";
import { getRepoRoot, makeBranchName } from "../../util/paths.js";
import { logInfo, logSuccess, logWarn, logError, logHeader, logSub, logDivider } from "../../util/logging.js";
import { execa } from "execa";
import simpleGit from "simple-git";
import fs from "node:fs";
import path from "node:path";

export interface PrResult {
  created: boolean;
  branch?: string;
  package: string;
  risk: "low" | "medium" | "high";
  testsPassed: boolean;
  reason?: string;
}

export async function cmdDepsPr(): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const pm = config.dependencies?.packageManager ?? "pnpm";
  const policy = config.dependencies?.policy ?? {};

  logHeader(`# Dependency PR Creator`);
  logDivider();

  const outdatedResult = await runOutdated(pm, repoRoot);

  if (outdatedResult.packages.length === 0) {
    logInfo("All packages are up to date. Nothing to create PRs for.");
    return;
  }

  const results: PrResult[] = [];

  for (const pkg of outdatedResult.packages) {
    const result = await processPackage(repoRoot, pkg, pm, policy);
    results.push(result);
  }

  // Summary
  logDivider();
  logHeader(`## Summary`);
  logDivider();

  const created = results.filter((r) => r.created);
  const skipped = results.filter((r) => !r.created);

  if (created.length > 0) {
    logSuccess(`Created ${created.length} PR(s):`);
    for (const r of created) {
      logSub(`- ${r.package}: ${r.branch} (tests: ${r.testsPassed ? "passed" : "failed"})`);
    }
  }

  if (skipped.length > 0) {
    logWarn(`Skipped ${skipped.length} package(s):`);
    for (const r of skipped) {
      logSub(`- ${r.package}: ${r.reason}`);
    }
  }

  if (created.length === 0 && skipped.length === 0) {
    logInfo("No packages processed.");
  }
}

async function processPackage(
  repoRoot: string,
  pkg: OutdatedPackage,
  pm: string,
  policy: Record<string, unknown>,
): Promise<PrResult> {
  const { package: pkgName, current, latest, isMajor } = pkg;

  // Check policy: skip major upgrades
  if (isMajor && policy.requireHumanForMajor !== false) {
    return {
      created: false,
      package: pkgName,
      risk: "high",
      testsPassed: false,
      reason: "Major version upgrade requires human review",
    };
  }

  // Determine risk
  const risk = isMajor ? "high" : "medium";

  // Create branch
  const branchName = `deps/${pkgName}-${latest.replace(/^v/, "")}`;
  const git = simpleGit(repoRoot);

  try {
    // Check if branch already exists
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      return {
        created: false,
        package: pkgName,
        risk,
        testsPassed: false,
        reason: `Branch ${branchName} already exists`,
      };
    }

    // Create branch from current HEAD
    await git.checkoutLocalBranch(branchName);

    // Update the package
    const installCmd = pm === "npm" ? "npm" : "pnpm";
    await execa(installCmd, ["install", `${pkgName}@${latest}`], {
      cwd: repoRoot,
    });

    // Run tests
    let testsPassed = false;
    try {
      await execa(pm === "npm" ? "npm" : "pnpm", ["test"], {
        cwd: repoRoot,
        timeout: 60000,
      });
      testsPassed = true;
    } catch {
      testsPassed = false;
    }

    // Commit if tests passed
    if (testsPassed) {
      await git.add(["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"].filter((f) => fs.existsSync(path.join(repoRoot, f))));
      const status = await git.status();
      if (status.files.length > 0) {
        await git.commit(`deps: update ${pkgName} from ${current} to ${latest}`);
      }
    }

    // Go back to original branch
    const currentBranch = (await git.branch()).current;
    await git.checkout("main");

    return {
      created: testsPassed,
      branch: branchName,
      package: pkgName,
      risk,
      testsPassed,
      reason: testsPassed ? undefined : "Tests failed — branch created but not committed",
    };
  } catch (err) {
    // Try to return to original branch
    try {
      await git.checkout("main");
    } catch {
      // ignore
    }

    return {
      created: false,
      package: pkgName,
      risk,
      testsPassed: false,
      reason: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
