/**
 * Pure drift core for depdrift: version collection, drift detection and
 * unified-version suggestion over plain data. The filesystem layer lives in
 * scan.js; everything here is unit-testable without touching disk.
 */
import { highestSemver } from "./semver.js";

/**
 * Collect every declared version of every dependency across packages.
 *
 * @param {Array<{path: string, deps: Record<string, string>}>} packages
 * @returns {Map<string, Map<string, string[]>>} dep -> version -> package paths
 */
export function collectVersions(packages) {
  const collected = new Map();
  for (const pkg of packages) {
    for (const [name, version] of Object.entries(pkg.deps ?? {})) {
      if (!collected.has(name)) collected.set(name, new Map());
      const versions = collected.get(name);
      if (!versions.has(version)) versions.set(version, []);
      const paths = versions.get(version);
      if (!paths.includes(pkg.path)) paths.push(pkg.path);
    }
  }
  return collected;
}

/**
 * Flag dependencies declared with more than one distinct version and
 * suggest the highest semver to unify on. Deterministic: drifts sorted by
 * name, version entries sorted lexically, package lists sorted.
 *
 * @param {Map<string, Map<string, string[]>>} collected
 * @returns {Array<{name: string, versions: Array<{version: string, packages: string[]}>, suggested: string|null}>}
 */
export function findDrift(collected) {
  const drifts = [];
  for (const [name, versions] of collected) {
    if (versions.size < 2) continue;
    const entries = [...versions.entries()]
      .map(([version, paths]) => ({ version, packages: [...paths].sort() }))
      .sort((a, b) => (a.version < b.version ? -1 : 1));
    drifts.push({
      name,
      versions: entries,
      suggested: highestSemver(entries.map((e) => e.version)),
    });
  }
  return drifts.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Plain counts for the CLI summary / JSON report. */
export function summarize(packages, collected, drifts) {
  return {
    packageCount: packages.length,
    uniqueDeps: collected.size,
    driftCount: drifts.length,
  };
}