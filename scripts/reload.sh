#!/bin/bash

npm install && npm run build 

# Linux                     
GOOS=linux GOARCH=amd64 go build -o signer-linux-x64 ./cmd/red-signer/main.go

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -o signer-macos-x64 ./cmd/red-signer/main.go

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o signer-macos-arm64 ./cmd/red-signer/main.go

# Windows
GOOS=windows GOARCH=amd64 go build -o signer-windows-x64.exe ./cmd/red-signer/main.go
# Copy files to local test vault (optional)
VAULT_PATH="/home/coder/Library/API/"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-red-signer"

if [ -d "$VAULT_PATH" ]; then
    echo "🔄 Copying build artifacts to $PLUGIN_DIR..."
    mkdir -p "$PLUGIN_DIR"
    cp main.js manifest.json styles.css "$PLUGIN_DIR/" 2>/dev/null || :
    
    # Copy the appropriate binary for the current system
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    if [ "$OS" = "linux" ]; then
        cp signer-linux-x64 "$PLUGIN_DIR/"
    elif [ "$OS" = "darwin" ]; then
        [ "$ARCH" = "arm64" ] && cp signer-macos-arm64 "$PLUGIN_DIR/" || cp signer-macos-x64 "$PLUGIN_DIR/"
    fi
    echo "✅ Reload complete."
else
    echo "⚠️ Vault path not found, skipping copy step."
fi
