#!/bin/bash

# build TiddlyDesktop for Windows and Linux only (preserving existing Mac builds)

# Remove old Windows/Linux/tiddlywiki builds, but KEEP mac output
rm -Rf output/win32
rm -Rf output/win64
rm -Rf output/linux32
rm -Rf output/linux64
rm -Rf source/tiddlywiki

# Install TiddlyWiki to node_modules/tiddlywiki
npm install

# Copy TiddlyWiki core files into the source directory
cp -RH node_modules/tiddlywiki source/tiddlywiki

# Copy TiddlyDesktop plugin into the source directory
cp -RH plugins/tiddlydesktop source/tiddlywiki/plugins/tiddlywiki

# Copy TiddlyDesktop version number
node propagate-version.js

# Create the output directories
mkdir -p output
mkdir -p output/win32
mkdir -p output/win32/TiddlyDesktop-win32-v$(./bin/get-version-number)
mkdir -p output/win64
mkdir -p output/win64/TiddlyDesktop-win64-v$(./bin/get-version-number)
mkdir -p output/linux32
mkdir -p output/linux32/TiddlyDesktop-linux32-v$(./bin/get-version-number)
mkdir -p output/linux64
mkdir -p output/linux64/TiddlyDesktop-linux64-v$(./bin/get-version-number)

# Calculate nw.js version
if [ $# -gt 0 ]; then
    NWJS_VERSION=$1
elif [ -z "$NWJS_VERSION" ]; then
    NWJS_VERSION=0.108.0
fi

# Windows 64-bit App
build_win64() {
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-win-x64/* output/win64/TiddlyDesktop-win64-v$(./bin/get-version-number)
    cp -RH source/* output/win64/TiddlyDesktop-win64-v$(./bin/get-version-number)
}

# Windows 32-bit App
build_win32() {
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-win-ia32/* output/win32/TiddlyDesktop-win32-v$(./bin/get-version-number)
    cp -RH source/* output/win32/TiddlyDesktop-win32-v$(./bin/get-version-number)
}

# Linux 64-bit App
build_linux64() {
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-linux-x64/* output/linux64/TiddlyDesktop-linux64-v$(./bin/get-version-number)
    cp -RH source/* output/linux64/TiddlyDesktop-linux64-v$(./bin/get-version-number)
}

# Linux 32-bit App
build_linux32() {
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-linux-ia32/* output/linux32/TiddlyDesktop-linux32-v$(./bin/get-version-number)
    cp -RH source/* output/linux32/TiddlyDesktop-linux32-v$(./bin/get-version-number)
}

# Run the builds
build_win32
build_win64
build_linux32
build_linux64

echo "Windows and Linux builds completed successfully!"
