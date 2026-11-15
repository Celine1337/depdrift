<p align="center">
  <img src="assets/banner.svg" width="830" alt="depdrift banner">
</p>
<p align="center">
  <a href="https://github.com/Celine1337/depdrift/releases"><img src="assets/nav-releases.svg" alt="Releases"></a>
  <a href="https://semver.org/"><img src="assets/nav-spec.svg" alt="SemVer 2.0.0"></a>
  <a href="LICENSE"><img src="assets/nav-mit.svg" alt="MIT"></a>
</p>

<img src="assets/section-about.svg" width="830" alt="About">

**depdrift** is a **dependency drift radar for JavaScript monorepos**. It sweeps a directory for every `package.json` (skipping `node_modules` and other noise), collects each dependency's declared version across all packages — `dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies` — and flags every dependency whose declarations **disagree**. For each drifted dependency it suggests the **highest semver** to unify on, comparing numerically (so `4.17.9 < 4.17.21`, never lexically) and honoring prerelease ordering per SemVer 2.0.0.

Drift is how monorepos rot: one package pins `lodash ^4.17.20`, another bumps to `^4.17.21`, and suddenly you ship two copies, debug phantom version bugs, and lose deduplication. depdrift makes the disagreement visible in one command and **exits `1` when drift exists**, so CI can gate on it. `--json` emits a machine-readable report for dashboards and bots.

The core (`src/semver.js`, `src/drift.js`) is **pure functions** — version collection, drift detection, highest-semver selection — unit-tested with vitest. The whole tool is plain JavaScript on `node:fs`/`node:path` with **zero runtime dependencies**; vitest is a dev-only test dependency.

<img src="assets/section-features.svg" width="830" alt="Features">

- **Full monorepo sweep** — every `package.json` under the root, recursively; `node_modules`, `.git`, `dist`, `coverage` skipped so vendored noise never pollutes the report.
- **All four dep sections** — dependencies, devDependencies, peerDependencies, optionalDependencies are collected and compared.
- **Drift detection** — any dependency declared at two or more distinct versions is flagged with every declaration and the packages that own it.
- **Highest-semver unifier** — suggests the exact declared string to converge on (`^4.17.21`), range prefix preserved; numeric comparison, prerelease-aware, opaque versions (`latest`, `workspace:*`) never win.
- **CI-ready exit codes** — `0` clean, `1` drift found, `2` bad usage/directory.
- **JSON reports** — `--json` emits `{packages, uniqueDeps, driftCount, drifts[]}` for automation.
- **Zero runtime deps** — pure `node:fs`/`node:path`; runs on any Node 18+ with nothing installed.
- **Tested** — vitest unit tests on the pure cores plus fixture-monorepo CLI tests asserting exit codes, drift output and suggestions.

<img src="assets/section-stack.svg" width="830" alt="Tech stack">

<img src="assets/section-install.svg" width="830" alt="Install">

Requires Node 18+. The CLI itself needs no install at all:

```bash
git clone https://github.com/Celine1337/depdrift.git
cd depdrift
./build.sh                  # writes bin/depdrift (pure JS, no compilation)
./bin/depdrift ./packages
```

To run the test suite, install the dev-only toolchain once:

```bash
npm install                 # vitest (dev dependency only)
./test.sh
```

<img src="assets/section-usage.svg" width="830" alt="Usage">

```bash
depdrift ./packages          # human report; exit 1 on drift
depdrift ./packages --json   # machine-readable report
```

```text
$ depdrift ./packages
depdrift: 3 package.json files, 2 unique dependencies in ./packages

DRIFT: lodash (2 versions)
  ^4.17.20  package.json, packages/a/package.json
  ^4.17.21  packages/b/package.json
  suggest: ^4.17.21

Result: 1 drifted dependency(ies) — versions disagree
```

Exit codes: `0` no drift, `1` drift found, `2` bad usage or unreadable directory. Malformed `package.json` files are warned about on stderr and skipped, never fatal.

<img src="assets/section-license.svg" width="830" alt="License">

MIT — see [LICENSE](LICENSE).