#!/bin/bash

# build and run TiddlyDesktop

# ./bld.sh || exit 1

# Determine which binary exists (use existing ResolutionBazaar app)
MAC64_BIN="./output/mac64/TiddlyDesktop-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/MacOS/nwjs"
MACAPP_BIN="./output/mac64/TiddlyDesktop-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/MacOS/nwjs"

if [ -x "$MAC64_BIN" ]; then
  exec "$MAC64_BIN" --debug --new-instance
elif [ -x "$MACAPP_BIN" ]; then
  exec "$MACAPP_BIN" --debug
else
  echo "Error: No TiddlyDesktop binary found in output/mac64."
  exit 1
fi
