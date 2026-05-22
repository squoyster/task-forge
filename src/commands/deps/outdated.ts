import { execa } from "execa";

export interface OutdatedResult {
  packages: OutdatedPackage[];
  raw: string;
}

export interface OutdatedPackage {
  package: string;
  current: string;
  latest: string;
  type: "dependencies" | "devDependencies";
  isMajor: boolean;
}

export async function runOutdated(
  packageManager: string,
  repoRoot: string,
): Promise<OutdatedResult> {
  const cmd = packageManager === "npm" ? "npm" : "pnpm";

  try {
    const result = await execa(cmd, ["outdated", "--json"], {
      cwd: repoRoot,
      reject: false,
    });

    const raw = result.stdout;
    let packages: OutdatedPackage[] = [];

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // npm outdated format
        for (const entry of parsed) {
          const current = (entry.current as string) ?? "unknown";
          const latest = (entry.latest as string) ?? "unknown";
          const pkgName = (entry.name as string) ?? (entry.package as string) ?? "unknown";
          packages.push({
            package: pkgName,
            current,
            latest,
            type: "dependencies",
            isMajor: isMajorBump(current, latest),
          });
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        // pnpm outdated format
        for (const [pkgName, info] of Object.entries(parsed)) {
          if (typeof info === "object" && info !== null) {
            const pkgInfo = info as Record<string, unknown>;
            const current = (pkgInfo.current as string) ?? (pkgInfo.installed as string) ?? "unknown";
            const latest = (pkgInfo.latest as string) ?? "unknown";
            packages.push({
              package: pkgName,
              current,
              latest,
              type: "dependencies",
              isMajor: isMajorBump(current, latest),
            });
          }
        }
      }
    } catch {
      // If JSON parsing fails, return raw
    }

    return { packages, raw };
  } catch {
    return { packages: [], raw: "Outdated command failed or not available." };
  }
}

function isMajorBump(current: string, latest: string): boolean {
  const curMajor = current.split(".")[0]?.replace(/[^0-9]/g, "");
  const latMajor = latest.split(".")[0]?.replace(/[^0-9]/g, "");
  if (!curMajor || !latMajor) return false;
  return parseInt(latMajor, 10) > parseInt(curMajor, 10);
}
