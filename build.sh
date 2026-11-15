#!/usr/bin/env bash
# depdrift is pure JavaScript — no compilation. Write the bin/depdrift
# launcher that runs the CLI on the system Node. Works fully offline.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "depdrift: node not found on PATH (Node 18+ required)" >&2
  exit 1
fi

mkdir -p bin
cat > bin/depdrift <<'WRAP'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$DIR/src/main.js" "$@"
WRAP
chmod +x bin/depdrift

echo "built bin/depdrift"