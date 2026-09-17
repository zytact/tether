#!/usr/bin/env bash
# Build the separately identified preview app, unpacked, without installing or packaging it.
set -euo pipefail
. "$(dirname "$0")/common.sh"
cd "$REPO"

vp build
vp pack
node scripts/package.ts --preview --dir

[ -x "$BIN" ] || { echo "Preview build did not produce $BIN" >&2; exit 1; }
echo "PREVIEW-BUILD: pass ($BIN)"
