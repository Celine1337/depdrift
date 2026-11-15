#!/usr/bin/env node
/**
 * depdrift CLI — dependency drift radar for JavaScript monorepos.
 *
 *   depdrift <dir> [--json]
 *
 * Exit codes: 0 no drift, 1 drift found, 2 usage/IO error.
 */
import { argv, exit, stderr, stdout } from "node:process";
import { collectVersions, findDrift, summarize } from "./drift.js";
import { findPackageJsons, isDirectory, readPackages } from "./scan.js";

const USAGE = `depdrift — dependency drift radar for monorepos

Usage: depdrift <dir> [--json]

  <dir>   directory to scan (every package.json, node_modules skipped)
  --json  emit a machine-readable JSON report

Flags dependencies declared at different versions across packages and
suggests the highest semver to unify on.
Exit codes: 0 no drift, 1 drift found, 2 bad usage or directory.`;

function fail(message) {
  stderr.write(`depdrift: ${message}\n`);
  exit(2);
}

function main() {
  const args = argv.slice(2);
  let dir = null;
  let json = false;
  for (const arg of args) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") {
      stdout.write(USAGE + "\n");
      exit(0);
    } else if (arg.startsWith("-")) fail(`unknown option '${arg}'`);
    else if (dir === null) dir = arg;
    else fail("expected exactly one directory argument");
  }
  if (dir === null) {
    stderr.write(USAGE + "\n");
    exit(2);
  }
  if (!isDirectory(dir)) fail(`not a directory: ${dir}`);

  const files = findPackageJsons(dir);
  const { packages, warnings } = readPackages(dir, files);
  for (const w of warnings) stderr.write(`depdrift: ${w}\n`);

  const collected = collectVersions(packages);
  const drifts = findDrift(collected);
  const stats = summarize(packages, collected, drifts);

  if (json) {
    stdout.write(
      JSON.stringify(
        {
          dir,
          packages: stats.packageCount,
          uniqueDeps: stats.uniqueDeps,
          driftCount: stats.driftCount,
          drifts,
        },
        null,
        2,
      ) + "\n",
    );
    exit(stats.driftCount > 0 ? 1 : 0);
  }

  const lines = [];
  lines.push(
    `depdrift: ${stats.packageCount} package.json files, ${stats.uniqueDeps} unique dependencies in ${dir}`,
  );
  lines.push("");
  if (drifts.length === 0) {
    lines.push("No dependency drift detected.");
  } else {
    for (const drift of drifts) {
      lines.push(`DRIFT: ${drift.name} (${drift.versions.length} versions)`);
      for (const entry of drift.versions) {
        lines.push(`  ${entry.version}  ${entry.packages.join(", ")}`);
      }
      lines.push(`  suggest: ${drift.suggested ?? "(no comparable semver)"}`);
      lines.push("");
    }
  }
  lines.push(
    stats.driftCount > 0
      ? `Result: ${stats.driftCount} drifted dependency(ies) — versions disagree`
      : "Result: no drift — all shared dependencies agree",
  );
  stdout.write(lines.join("\n") + "\n");
  exit(stats.driftCount > 0 ? 1 : 0);
}

main();