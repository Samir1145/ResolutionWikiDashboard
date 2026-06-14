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
mkdir -p output/win32/ResolutionBazaar-win32-v$(./bin/get-version-number)
mkdir -p output/win64
mkdir -p output/win64/ResolutionBazaar-win64-v$(./bin/get-version-number)
mkdir -p output/linux32
mkdir -p output/linux32/ResolutionBazaar-linux32-v$(./bin/get-version-number)
mkdir -p output/linux64
mkdir -p output/linux64/ResolutionBazaar-linux64-v$(./bin/get-version-number)

# Calculate nw.js version
if [ $# -gt 0 ]; then
    NWJS_VERSION=$1
elif [ -z "$NWJS_VERSION" ]; then
    NWJS_VERSION=0.108.0
fi

# Windows 64-bit App
build_win64() {
    local target_dir="output/win64/ResolutionBazaar-win64-v$(./bin/get-version-number)"
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-win-x64/* "$target_dir"

    # Create a temporary packaging directory
    rm -Rf tmp_packaging_win64
    cp -RH source tmp_packaging_win64
    # Compile dashboard.js to V8 bytecode
    if [ -x "nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc" ]; then
      echo "Compiling dashboard.js to bytecode for Windows 64-bit..."
      nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc tmp_packaging_win64/js/dashboard.js tmp_packaging_win64/js/dashboard.bin && \
      rm tmp_packaging_win64/js/dashboard.js
    fi
    (cd tmp_packaging_win64 && zip -r "../$target_dir/package.nw" *)
    rm -Rf tmp_packaging_win64

    cat "$target_dir/nw.exe" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar.exe"
    chmod +x "$target_dir/ResolutionBazaar.exe"
    rm "$target_dir/nw.exe"
    rm "$target_dir/package.nw"
}

# Windows 32-bit App
build_win32() {
    local target_dir="output/win32/ResolutionBazaar-win32-v$(./bin/get-version-number)"
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-win-ia32/* "$target_dir"
    (cd source && zip -r "../$target_dir/package.nw" *)
    cat "$target_dir/nw.exe" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar.exe"
    chmod +x "$target_dir/ResolutionBazaar.exe"
    rm "$target_dir/nw.exe"
    rm "$target_dir/package.nw"
}

# Linux 64-bit App
build_linux64() {
    local target_dir="output/linux64/ResolutionBazaar-linux64-v$(./bin/get-version-number)"
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-linux-x64/* "$target_dir"

    # Create a temporary packaging directory
    rm -Rf tmp_packaging_linux64
    cp -RH source tmp_packaging_linux64
    # Compile dashboard.js to V8 bytecode
    if [ -x "nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc" ]; then
      echo "Compiling dashboard.js to bytecode for Linux 64-bit..."
      nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc tmp_packaging_linux64/js/dashboard.js tmp_packaging_linux64/js/dashboard.bin && \
      rm tmp_packaging_linux64/js/dashboard.js
    fi
    (cd tmp_packaging_linux64 && zip -r "../$target_dir/package.nw" *)
    rm -Rf tmp_packaging_linux64

    cat "$target_dir/nw" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar"
    chmod +x "$target_dir/ResolutionBazaar"
    rm "$target_dir/nw"
    rm "$target_dir/package.nw"
}

# Linux 32-bit App
build_linux32() {
    local target_dir="output/linux32/ResolutionBazaar-linux32-v$(./bin/get-version-number)"
    cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-linux-ia32/* "$target_dir"
    (cd source && zip -r "../$target_dir/package.nw" *)
    cat "$target_dir/nw" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar"
    chmod +x "$target_dir/ResolutionBazaar"
    rm "$target_dir/nw"
    rm "$target_dir/package.nw"
}

# Run the builds
build_win32
build_win64
build_linux32
build_linux64

echo "Windows and Linux builds completed successfully!"
