#!/usr/bin/env bash
# Self-contained test suite for depdrift: vitest unit tests on the pure
# semver/drift cores, then CLI fixture monorepos (deliberate drift, clean,
# node_modules skipping, JSON, exit codes). Fixtures live in mktemp dirs only.
set -uo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.local/toolchains/node/bin:$PATH"
fi

pass=0; fail=0
ok(){ pass=$((pass+1)); echo "ok $pass - $1"; }
bad(){ fail=$((fail+1)); echo "FAIL - $1"; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# --- unit tests (pure semver + drift cores) --------------------------------
if ./node_modules/.bin/vitest run --reporter=dot > "$TMP/vitest.log" 2>&1; then
  ok "vitest unit tests (semver + drift cores)"
else
  bad "vitest unit tests"; tail -30 "$TMP/vitest.log"
fi

# --- build ------------------------------------------------------------------
if ./build.sh > /dev/null; then
  ok "build.sh writes bin/depdrift"
else
  bad "build.sh"; exit 1
fi
DD="./bin/depdrift"

# --- fixture: monorepo with deliberate lodash drift -------------------------
mkdir -p "$TMP/drift/packages/a" "$TMP/drift/packages/b" "$TMP/drift/node_modules/junk"
cat > "$TMP/drift/package.json" <<'EOF'
{ "name": "root", "private": true, "dependencies": { "lodash": "^4.17.20" } }
EOF
cat > "$TMP/drift/packages/a/package.json" <<'EOF'
{ "name": "a", "dependencies": { "lodash": "^4.17.20", "react": "^18.2.0" } }
EOF
cat > "$TMP/drift/packages/b/package.json" <<'EOF'
{ "name": "b", "dependencies": { "lodash": "^4.17.21", "react": "^18.2.0" } }
EOF
cat > "$TMP/drift/node_modules/junk/package.json" <<'EOF'
{ "name": "junk", "dependencies": { "lodash": "0.0.1" } }
EOF

out=$($DD "$TMP/drift"); rc=$?
[ "$rc" -eq 1 ] && ok "drift fixture exits 1" || bad "drift fixture exit (got $rc, want 1)"
printf '%s' "$out" | grep -qF "DRIFT: lodash (2 versions)" && ok "lodash drift reported" || bad "lodash drift missing"
printf '%s' "$out" | grep -qF "^4.17.20" && ok "older version listed" || bad "older version missing"
printf '%s' "$out" | grep -qF "^4.17.21" && ok "newer version listed" || bad "newer version missing"
printf '%s' "$out" | grep -qF "suggest: ^4.17.21" && ok "highest semver suggested" || bad "suggestion missing"
printf '%s' "$out" | grep -qF "3 package.json files" && ok "node_modules skipped (3 packages)" || bad "package count wrong"
printf '%s' "$out" | grep -qF "react" && bad "react falsely flagged" || ok "agreeing dep (react) not flagged"

# --- fixture: clean monorepo -------------------------------------------------
mkdir -p "$TMP/clean/packages/a" "$TMP/clean/packages/b"
cat > "$TMP/clean/package.json" <<'EOF'
{ "name": "root", "dependencies": { "lodash": "^4.17.21" } }
EOF
cat > "$TMP/clean/packages/a/package.json" <<'EOF'
{ "name": "a", "dependencies": { "lodash": "^4.17.21", "react": "^18.2.0" } }
EOF
cat > "$TMP/clean/packages/b/package.json" <<'EOF'
{ "name": "b", "dependencies": { "lodash": "^4.17.21", "react": "^18.2.0" } }
EOF
out=$($DD "$TMP/clean"); rc=$?
[ "$rc" -eq 0 ] && ok "clean fixture exits 0" || bad "clean fixture exit (got $rc, want 0)"
printf '%s' "$out" | grep -qF "no drift" && ok "clean fixture reports no drift" || bad "clean report wrong"

# --- fixture: two drifted deps ----------------------------------------------
mkdir -p "$TMP/multi/packages/a" "$TMP/multi/packages/b"
cat > "$TMP/multi/packages/a/package.json" <<'EOF'
{ "name": "a", "dependencies": { "lodash": "^4.17.20", "axios": "^1.6.0" } }
EOF
cat > "$TMP/multi/packages/b/package.json" <<'EOF'
{ "name": "b", "dependencies": { "lodash": "^4.17.21", "axios": "^1.7.0" } }
EOF
out=$($DD "$TMP/multi"); rc=$?
[ "$rc" -eq 1 ] && ok "multi-drift fixture exits 1" || bad "multi-drift exit (got $rc)"
printf '%s' "$out" | grep -qF "2 drifted dependency(ies)" && ok "both drifts counted" || bad "drift count wrong"
printf '%s' "$out" | grep -qF "suggest: ^1.7.0" && ok "axios unified to highest" || bad "axios suggestion missing"

# --- --json ------------------------------------------------------------------
json=$($DD "$TMP/drift" --json); rc=$?
[ "$rc" -eq 1 ] && ok "--json keeps drift exit code" || bad "--json exit (got $rc)"
if printf '%s' "$json" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const j = JSON.parse(s);
    const d = j.drifts.find((x) => x.name === "lodash");
    if (j.driftCount !== 1 || !d || d.suggested !== "^4.17.21") process.exit(1);
    if (d.versions.length !== 2) process.exit(1);
  });
' 2>/dev/null; then
  ok "--json report parses with driftCount + suggested"
else
  bad "--json report invalid"
fi

# --- error paths --------------------------------------------------------------
$DD "$TMP/does-not-exist" > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] && ok "missing directory exits 2" || bad "missing dir exit (got $rc)"
$DD > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] && ok "no arguments exits 2" || bad "no-args exit (got $rc)"

echo "----------------------------------------"
echo "depdrift: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then echo "ALL CHECKS PASSED"; else exit 1; fi