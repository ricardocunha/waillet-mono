#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
PACKAGE_SCRIPT="$ROOT_DIR/scripts/package-source.sh"

FIREFOX_ZIP_DEFAULT="$ROOT_DIR/waillet-firefox.zip"
SOURCE_ZIP_DEFAULT="$ROOT_DIR/waillet-mozilla-source.zip"

FIREFOX_ZIP_PATH="${1:-$FIREFOX_ZIP_DEFAULT}"
SOURCE_ZIP_PATH="${2:-$SOURCE_ZIP_DEFAULT}"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required but not installed." >&2
  exit 1
fi

if [ ! -d "$EXT_DIR" ]; then
  echo "Missing extension directory: $EXT_DIR" >&2
  exit 1
fi

if [ ! -x "$PACKAGE_SCRIPT" ]; then
  echo "Missing package script: $PACKAGE_SCRIPT" >&2
  exit 1
fi

pushd "$EXT_DIR" >/dev/null
npm run build:firefox
popd >/dev/null

DIST_FIREFOX="$EXT_DIR/dist-firefox"
if [ ! -d "$DIST_FIREFOX" ]; then
  echo "Missing Firefox build output: $DIST_FIREFOX" >&2
  exit 1
fi

# Create Firefox production zip with files at the archive root.
if [ -d "$FIREFOX_ZIP_PATH" ]; then
  FIREFOX_ZIP_PATH="$FIREFOX_ZIP_PATH/$(basename "$FIREFOX_ZIP_DEFAULT")"
fi

pushd "$DIST_FIREFOX" >/dev/null
zip -r "$FIREFOX_ZIP_PATH" . -x "*.DS_Store"
popd >/dev/null

echo "Created Firefox zip: $FIREFOX_ZIP_PATH"

"$PACKAGE_SCRIPT" "$SOURCE_ZIP_PATH"
