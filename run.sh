#!/bin/bash

# build and run TiddlyDesktop

# ./bld.sh || exit 1

VERSION=$(./bin/get-version-number)

# ── Sync source JS/HTML into all output bundles so edits are live ──────────
sync_to_bundle() {
  local BUNDLE="$1"
  if [ -d "$BUNDLE" ]; then
    echo "[run.sh] Syncing source → $BUNDLE"
    rsync -a --include="*/" --include="*.js" --include="*.html" --include="*.css" \
          --exclude="*" source/js/ "$BUNDLE/js/"
    rsync -a --include="*/" --include="*.html" --include="*.css" \
          --exclude="*" source/html/ "$BUNDLE/html/"
    rm -f "$BUNDLE/js/dashboard.bin"
  fi
}

sync_to_bundle "./output/mac64/ResolutionBazaar-mac64-v${VERSION}/ResolutionBazaar.app/Contents/Resources/app.nw"
sync_to_bundle "./output/macapplesilicon/ResolutionBazaar-macapplesilicon-v${VERSION}/ResolutionBazaar.app/Contents/Resources/app.nw"
# ───────────────────────────────────────────────────────────────────────────

# Determine which binary exists (use existing ResolutionBazaar app)
MAC64_BIN="./output/mac64/ResolutionBazaar-mac64-v${VERSION}/ResolutionBazaar.app/Contents/MacOS/nwjs"
MACAPP_BIN="./output/macapplesilicon/ResolutionBazaar-macapplesilicon-v${VERSION}/ResolutionBazaar.app/Contents/MacOS/nwjs"

if [ -x "$MAC64_BIN" ]; then
  exec "$MAC64_BIN" --debug --new-instance
elif [ -x "$MACAPP_BIN" ]; then
  exec "$MACAPP_BIN" --debug
else
  echo "Error: No Resolution Bazaar binary found in output."
  exit 1
fi
