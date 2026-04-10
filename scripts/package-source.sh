#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_NAME="waillet-source-$(date +%Y%m%d).zip"
OUT_PATH="${1:-$ROOT_DIR/$DEFAULT_NAME}"

if [ -d "$OUT_PATH" ]; then
  OUT_PATH="$OUT_PATH/$DEFAULT_NAME"
fi

INCLUDE_PATHS=(
  README.md
  backend-v2
  extension
  dapp
  site
)

# Common excludes for source packaging.
EXCLUDES=(
  ".git/*"
  ".idea/*"
  ".vscode/*"
  "backend-v2/.idea/*"
  "backend-v2/.vscode/*"
  "extension/.idea/*"
  "extension/.vscode/*"
  "extension/node_modules/*"
  "extension/dist/*"
  "extension/dist-firefox/*"
  "extension/coverage/*"
  "dapp/.idea/*"
  "dapp/.vscode/*"
  "dapp/node_modules/*"
  "dapp/dist/*"
  "site/.idea/*"
  "site/.vscode/*"
  "site/node_modules/*"
  "site/dist/*"
  "**/.env"
  "**/.env.*"
  "**/*.zip"
  "waillet-mozilla-source/*"
  "waillet-mozilla-source-*/*"
)

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required but not installed." >&2
  exit 1
fi

for path in "${INCLUDE_PATHS[@]}"; do
  if [ ! -e "$ROOT_DIR/$path" ]; then
    echo "Missing path: $ROOT_DIR/$path" >&2
    exit 1
  fi
done

pushd "$ROOT_DIR" >/dev/null
zip -r "$OUT_PATH" "${INCLUDE_PATHS[@]}" -x "${EXCLUDES[@]}"
popd >/dev/null

echo "Created: $OUT_PATH"
