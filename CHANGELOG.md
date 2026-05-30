
# Changelog

All notable changes to the **Obsidian Red Signer** plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] – 2026-05-30

### Added
- **Knowledge branch classification** – users now select a branch (e.g., “Formal Sciences”) and an optional sub‑branch when signing the first note.
- **Branch author locking** – the manifest stores `branch_author` (public key of the first signer). Only that author can later modify the branch or sub‑branch.
- **Dynamic sub‑branch dropdown** – sub‑branch options change based on the selected branch (predefined lists for each branch).
- **Automatic README** – a `README.md` is created in `~/.red-network/` warning about the importance of the private key.
- **Platform‑specific binary detection** – no more manual renaming; the plugin now expects exact binary names (`signer-linux-x64`, `signer-macos-x64`, `signer-macos-arm64`, `signer-windows-x64.exe`).
- **Lock icon and warning** in the modal when a user is not the branch author.

### Changed
- **Installation instructions** updated to reflect the new binary naming scheme and the two installation methods (script and manual).
- **Status bar** now shows “Signed” only if the file hash matches the manifest entry; otherwise “Unsigned”.
- **Improved error handling** when the binary is missing or permissions are wrong.
- **Better manifest parsing** – the plugin now reads/writes the new top‑level manifest fields (`branch`, `sub_branch`, `branch_author`) while preserving backward compatibility with older manifests.

### Fixed
- **Race condition** when creating the manifest and signing the first file simultaneously.
- **Path traversal vulnerability** when computing relative paths (hardened by using `filepath.Clean` and disallowing `..` prefixes).
- **Missing executable permission** on Unix systems – the plugin now automatically runs `chmod +x` on the binary.

## [1.1.0] – 2026-05-15

### Added
- **Status bar indicator** that shows “Signed” or “Unsigned” for the active file.
- **Copy public key** command and button in the modal.
- **Automatic manifest initialisation** when signing the first file in a vault.
- **Ribbon icon** and editor context menu item for quick signing.

### Changed
- Switched from `exec` to `execFile` to prevent command injection vulnerabilities.
- Key directory changed from `~/.red` to `~/.red-network` for clarity.
- Improved error messages when the binary is missing.

### Fixed
- **Windows compatibility** – binary detection now works correctly on Windows.
- **Manifest corruption** when two files were signed in rapid succession (now uses atomic file writes).

## [1.0.0] – 2026-04-20

### Added
- Initial release.
- Sign Markdown files with Ed25519 keys.
- Generate and store private key in `~/.red/`.
- Update `manifest.json` with file hash, public key, and signature.
- Minimal UI (ribbon icon) and command palette integration.