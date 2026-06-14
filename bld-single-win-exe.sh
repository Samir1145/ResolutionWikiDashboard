#!/bin/bash

# Script to build a single standalone Windows executable (.exe) from macOS

VERSION=$(./bin/get-version-number)
NWJS_VERSION="0.108.0"

# Check for 7z dependency
if ! command -v 7z &> /dev/null; then
    echo "p7zip is not installed. Installing via Homebrew..."
    brew install p7zip || { echo "Failed to install p7zip. Please install it manually."; exit 1; }
fi

# Ensure bin directory exists
mkdir -p bin

# Download and extract the Windows SFX loader stub (7zSD.sfx) if not present
if [ ! -f "bin/7zSD.sfx" ]; then
    echo "7zSD.sfx not found in bin/. Downloading LZMA SDK..."
    EXTRA_ZIP_URL="https://downloads.sourceforge.net/sevenzip/LZMA%20SDK/lzma2301.7z"
    curl -L "$EXTRA_ZIP_URL" -o bin/lzma.7z || { echo "Failed to download LZMA SDK"; exit 1; }
    
    echo "Extracting 7zSD.sfx..."
    7z e bin/lzma.7z bin/7zSD.sfx -obin/ -y > /dev/null
    rm bin/lzma.7z
    
    if [ ! -f "bin/7zSD.sfx" ]; then
        echo "Error: Failed to extract 7zSD.sfx"
        exit 1
    fi
fi

# Run the standard Windows build (both 32-bit and 64-bit)
echo "Running Windows build..."
./bld-win-linux.sh "$NWJS_VERSION" || exit 1

# Package win64
package_win64() {
    local target_dir="output/win64/ResolutionBazaar-win64-v$VERSION"
    local output_exe="output/win64/ResolutionBazaar-win64-v${VERSION}_Portable.exe"
    
    echo "Packaging 64-bit portable app..."
    
    # 1. Create temporary 7z archive of all files in the build folder
    # Output to output/win64/app_win64.7z (outside the target folder to prevent recursive inclusion)
    rm -f "output/win64/app_win64.7z"
    (cd "$target_dir" && 7z a -mx9 -r "../app_win64.7z" * > /dev/null)
    
    # 2. Create the configuration file for the SFX module
    cat <<EOF > "output/win64/config_win64.txt"
;!@Install@!UTF-8!
Title="ResolutionBazaar v$VERSION"
RunProgram="ResolutionBazaar.exe"
;!@InstallEnd@!
EOF

    # 3. Concatenate the SFX stub, config, and archive into the single executable
    cat "bin/7zSD.sfx" "output/win64/config_win64.txt" "output/win64/app_win64.7z" > "$output_exe"
    chmod +x "$output_exe"
    
    # 4. Clean up temporary files
    rm -f "output/win64/app_win64.7z"
    rm -f "output/win64/config_win64.txt"
    
    echo "Created: $output_exe"
}

# Package win32
package_win32() {
    local target_dir="output/win32/ResolutionBazaar-win32-v$VERSION"
    local output_exe="output/win32/ResolutionBazaar-win32-v${VERSION}_Portable.exe"
    
    echo "Packaging 32-bit portable app..."
    
    rm -f "output/win32/app_win32.7z"
    (cd "$target_dir" && 7z a -mx9 -r "../app_win32.7z" * > /dev/null)
    
    cat <<EOF > "output/win32/config_win32.txt"
;!@Install@!UTF-8!
Title="ResolutionBazaar v$VERSION"
RunProgram="ResolutionBazaar.exe"
;!@InstallEnd@!
EOF

    cat "bin/7zSD.sfx" "output/win32/config_win32.txt" "output/win32/app_win32.7z" > "$output_exe"
    chmod +x "$output_exe"
    
    rm -f "output/win32/app_win32.7z"
    rm -f "output/win32/config_win32.txt"
    
    echo "Created: $output_exe"
}

package_win64
package_win32

# Copy portable executables to a consolidated portable folder
mkdir -p output/portable
cp "output/win64/ResolutionBazaar-win64-v${VERSION}_Portable.exe" output/portable/
cp "output/win32/ResolutionBazaar-win32-v${VERSION}_Portable.exe" output/portable/

echo "--------------------------------------------------------"
echo "Portable standalone executables are ready at:"
echo "  - output/portable/ResolutionBazaar-win64-v${VERSION}_Portable.exe"
echo "  - output/portable/ResolutionBazaar-win32-v${VERSION}_Portable.exe"
echo "--------------------------------------------------------"
echo "Single executable packaging completed successfully!"
