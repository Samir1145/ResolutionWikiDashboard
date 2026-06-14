#!/bin/bash

# build TiddlyDesktop

# Remove any old build
rm -Rf output
rm -Rf source/tiddlywiki

# Install TiddlyWiki to node_modules/tiddlywiki
npm install

# Copy TiddlyWiki core files into the source directory
cp -RH node_modules/tiddlywiki source/tiddlywiki

# Copy TiddlyDesktop plugin into the source directory
cp -RH plugins/tiddlydesktop source/tiddlywiki/plugins/tiddlywiki

# Copy TiddlyDesktop version number from package.json to the plugin.info of the plugin and the tiddler $:/plugins/tiddlywiki/tiddlydesktop/version
node propagate-version.js

# Create the output directories
mkdir -p output
mkdir -p output/mac64
mkdir -p output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)
mkdir -p output/macapplesilicon
mkdir -p output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)
mkdir -p output/win32
mkdir -p output/win32/ResolutionBazaar-win32-v$(./bin/get-version-number)
mkdir -p output/win64
mkdir -p output/win64/ResolutionBazaar-win64-v$(./bin/get-version-number)
mkdir -p output/linux32
mkdir -p output/linux32/ResolutionBazaar-linux32-v$(./bin/get-version-number)
mkdir -p output/linux64
mkdir -p output/linux64/ResolutionBazaar-linux64-v$(./bin/get-version-number)

# For each platform, copy the stock nw.js binaries overlaying the "source" directory (and icons and plist for the Mac)

# Calculate nw.js version

if [ $# -gt 0 ]; then
    NWJS_VERSION=$1
elif [ -z "$NWJS_VERSION" ]; then
    NWJS_VERSION=0.108.0
fi

# Build function definitions (which will be called at the end of the script)

# OS X 64-bit App
build_mac64() {

cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjs.app output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app
cp -RH source output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/app.nw

# Compile dashboard.js to V8 bytecode
if [ -x "nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc" ]; then
  echo "Compiling dashboard.js to bytecode for macOS 64-bit..."
  nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-x64/nwjc output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/app.nw/js/dashboard.js output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/app.nw/js/dashboard.bin && \
  rm output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/app.nw/js/dashboard.js
fi

cp icons/app.icns output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/nw.icns
cp Info.plist output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Info.plist

for f in output/mac64/ResolutionBazaar-mac64-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/*.lproj
do
	cp "./strings/InfoPlist.strings" "$f/InfoPlist.strings"
done

}

# OS X Apple Silicon App
build_macapplesilicon() {

cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-osx-arm64/nwjs.app output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app
cp -RH source output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/app.nw
cp icons/app.icns output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/nw.icns
cp Info.plist output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Info.plist

for f in output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app/Contents/Resources/*.lproj
do
	cp "./strings/InfoPlist.strings" "$f/InfoPlist.strings"
done

xattr -c output/macapplesilicon/ResolutionBazaar-macapplesilicon-v$(./bin/get-version-number)/ResolutionBazaar.app

}

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

# # Windows 32-bit App
build_win32() {
local target_dir="output/win32/ResolutionBazaar-win32-v$(./bin/get-version-number)"
cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-win-ia32/* "$target_dir"
(cd source && zip -r "../$target_dir/package.nw" *)
cat "$target_dir/nw.exe" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar.exe"
chmod +x "$target_dir/ResolutionBazaar.exe"
rm "$target_dir/nw.exe"
rm "$target_dir/package.nw"
}

# # Linux 64-bit App
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

# # Linux 32-bit App
build_linux32() {
local target_dir="output/linux32/ResolutionBazaar-linux32-v$(./bin/get-version-number)"
cp -RH nwjs/nwjs-sdk-v${NWJS_VERSION}-linux-ia32/* "$target_dir"
(cd source && zip -r "../$target_dir/package.nw" *)
cat "$target_dir/nw" "$target_dir/package.nw" > "$target_dir/ResolutionBazaar"
chmod +x "$target_dir/ResolutionBazaar"
rm "$target_dir/nw"
rm "$target_dir/package.nw"
}

# # Linux AppImage
# # For Github CI, only
build_linux_appimage() {
appdir="output/AppDir.$ARCH"
build_dependencies="curl findutils desktop-file-utils"
font_packages="fonts-dejavu-core fonts-dejavu-extra"
runtime_dependencies="$font_packages libnss3 libnspr4 libasound2-dev libatomic1 libatk1.0-0 libcups2-dev libxkbcommon-dev libatspi2.0-dev libxcomposite-dev libxdamage-dev libxfixes-dev libxrandr-dev libpango1.0-dev libgbm-dev libcairo2-dev libxi-dev libxrender-dev libwayland-dev libfribidi-dev libthai-dev libharfbuzz-dev libpng-dev libfontconfig-dev libfreetype-dev libpixman-1-dev libdatrie-dev libgraphite2-dev libbz2-dev fonts-dejavu"
package_arch=""
appimagetool_arch=""
sudo apt-get install -y $runtime_dependencies $build_dependencies

case "$ARCH" in
    ia32)
        package_arch="linux32"
        appimagetool_arch="i686"
        curl -L https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-i686.AppImage -o output/appimagetool-$ARCH.AppImage
    ;;
    x64)
        package_arch="linux64"
        appimagetool_arch="x86_64"
        curl -L https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -o output/appimagetool-$ARCH.AppImage
    ;;
esac

chmod u+x output/appimagetool-$ARCH.AppImage
mkdir -p $appdir
mkdir -p $appdir/usr/{bin,lib,share}
mkdir -p $appdir/usr/share/fonts/truetype/dejavu
cp icons/app-icon1024.png $appdir/resolutionbazaar.png
cp linux/AppRun $appdir/
cp linux/resolutionbazaar.desktop $appdir/
cp -r output/$package_arch/ResolutionBazaar-$package_arch-v$(./bin/get-version-number)/* $appdir/usr/bin/

libraries=$(dpkg -L $runtime_dependencies | grep "\.so" 2>/dev/null)
for f in $libraries; do
    cp $f* $appdir/usr/lib/
done

dpkg -L $font_packages | grep "\.ttf" 2>/dev/null | xargs -I '{}' -- cp '{}' $appdir/usr/share/fonts/truetype/dejavu/
VERSION=$(./bin/get-version-number)
ARCH=$appimagetool_arch ./output/appimagetool-$ARCH.AppImage --no-appstream $appdir output/resolutionbazaar-$package_arch-v$(./bin/get-version-number).AppImage
}

if [ "$CI" = "true" ]; then
    # Running in GitHub Actions, where each platform builds as a separate step, in parallel, with PLATFORM and ARCH variables supplied by the GitHub Actions script
	case "$PLATFORM-$ARCH" in
		osx-x64)
			build_mac64
			;;
		osx-arm64)
			build_macapplesilicon
			;;
		win-ia32)
			build_win32
			;;
		win-x64)
			build_win64
			;;
		linux-ia32)
			build_linux32
			build_linux_appimage
			;;
		linux-x64)
			build_linux64
			build_linux_appimage
			;;
	esac
else
    # Running at the command line, where each platfom builds one at a time in sequence
	build_mac64
	build_macapplesilicon
	build_win32
	build_win64
	build_linux32
	build_linux64
fi
