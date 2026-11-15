/**
 * Filesystem layer for depdrift: find every package.json under a root
 * (skipping node_modules and other noise), and read the dependency sections.
 * Built-in node:fs / node:path only — zero runtime dependencies.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "build"]);
const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** Recursively collect package.json paths, sorted for deterministic output. */
export function findPackageJsons(root) {
  const found = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: skip silently
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(full);
      } else if (entry.isFile() && entry.name === "package.json") {
        found.push(full);
      }
    }
  };
  visit(root);
  return found.sort();
}

/**
 * Read dependency declarations from each package.json. Malformed JSON is
 * reported as a warning and skipped, never fatal.
 *
 * @returns {{packages: Array<{path: string, deps: Record<string,string>}>, warnings: string[]}}
 */
export function readPackages(root, files) {
  const packages = [];
  const warnings = [];
  for (const file of files) {
    let json;
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      warnings.push(`skipping unreadable ${relative(root, file)}: ${err.message}`);
      continue;
    }
    if (json === null || typeof json !== "object") {
      warnings.push(`skipping non-object ${relative(root, file)}`);
      continue;
    }
    const deps = {};
    for (const section of DEP_SECTIONS) {
      const sec = json[section];
      if (sec === null || typeof sec !== "object") continue;
      for (const [name, version] of Object.entries(sec)) {
        if (typeof version === "string") deps[name] = version;
      }
    }
    packages.push({ path: relative(root, file) || "package.json", deps });
  }
  return { packages, warnings };
}

/** True when `dir` exists and is a directory (CLI exit-2 gate). */
export function isDirectory(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}