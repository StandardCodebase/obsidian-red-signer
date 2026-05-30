Here is the **updated README** (replace the existing one) and a new **CHANGELOG.md** file for the Obsidian Red Signer plugin.

---

## 📄 Updated `README.md`

```markdown
# Obsidian Red Signer (Project R.E.D. Network)

**The official authoring bridge for the Project R.E.D. decentralized knowledge base.**

This plugin allows maintainers to cryptographically sign their Markdown notes with Ed25519 directly inside Obsidian. It automatically generates and updates the network's `manifest.json`, securely storing the file hash, your public key, your cryptographic signature, and **branch classification** metadata.

---

## 🦅 The Philosophy: Why We Built This

Project R.E.D. is built on a strict engineering philosophy: **stateless, lightweight, and execution‑focused.** When we designed the security grid for the network, we needed a visual interface for maintainers to hash, sign, and manage their guides. The standard industry reaction is to reinvent the wheel – to waste weeks building a bloated, custom desktop application in C++ and Qt6 just to render a file tree and click a "Sign" button.

We rejected that.

Instead of building an authoring environment from scratch, we simply made use of one of the best local‑first Markdown editors in the world: Obsidian. By turning our signing tool into an Obsidian plugin, we achieved zero context‑switching. Maintainers can write their guides, hit a hotkey, and have the Ed25519 cryptography handled completely invisibly in the background.

We build tools that work. We don't reinvent the wheel.

---

## ⚡ Features

- **Zero‑Friction Signing:** Sign your files with one click via the ribbon icon, editor menu, or command palette.
- **The Sovereign Identity Vault:** Automatically generates and stores your permanent `maintainer.key` safely outside your working directory (`~/.red-network/`).
- **Network Manifest Injection:** Automatically discovers and updates the `manifest.json` at your vault root, formatting the keys exactly as the Project R.E.D. Go engine requires.
- **Knowledge Branch Classification:** When signing your first note, you choose a **branch** (e.g., “Formal Sciences”) and an optional **sub‑branch** (e.g., “Mathematics/Logic”). These are stored in the manifest and become immutable for that vault – only the original author can change them.
- **Real‑Time Security Status:** A status bar indicator that displays `✓ Signed` (green) or `Unsigned` (gray) by dynamically comparing your live file hash against the manifest.
- **Public Key Clipboard:** Instantly copy your public key to add to the server’s `TrustedMaintainers` ring.
- **README Protection:** Automatically creates a `README.md` inside `~/.red-network/` warning you never to delete your private key.

---

## 🛠️ Installation & Setup

Choose the method that fits your workflow.

### 1. Script (recommended)

**Prerequisites:** `npm` must be installed on your system.

#### macOS / Linux

Open a terminal and run:

```bash
bash <(curl -s https://raw.githubusercontent.com/StandardCodebase/obsidian-red-signer/main/install-red-signer.sh)
```

#### Windows

Open PowerShell **as Administrator** and run:

```powershell
iex (iwr -UseBasicParsing https://raw.githubusercontent.com/StandardCodebase/obsidian-red-signer/main/install-red-signer.ps1).Content
```

The script will:
- Download the latest plugin and the correct binary for your OS.
- Place everything in the right Obsidian plugins folder.
- Make the binary executable (macOS/Linux).

### 2. Manual Installation

1. Go to the [Releases page](https://github.com/StandardCodebase/obsidian-red-signer/releases).
2. Download the latest `red-signer.zip` **and** the binary for your operating system:

   | Your OS              | Binary Name                  |
   | -------------------- | ---------------------------- |
   | Linux                | `signer-linux-x64`           |
   | macOS (Intel)        | `signer-macos-x64`           |
   | macOS (Apple Silicon)| `signer-macos-arm64`         |
   | Windows              | `signer-windows-x64.exe`     |

3. Extract `red-signer.zip` – you will get a folder named `red-signer`.
4. Move the downloaded binary (e.g., `signer-linux-x64`) **inside** that `red-signer` folder.
5. Move the whole `red-signer` folder into your Obsidian vault’s plugins directory:  
   `YourVault/.obsidian/plugins/`
6. **macOS / Linux only** – make the binary executable:

   ```bash
   chmod +x /path/to/YourVault/.obsidian/plugins/red-signer/signer-*
   ```

7. Restart Obsidian (or reload community plugins) and enable **Red Signer** in `Settings → Community plugins`.

✅ **No renaming needed** – the plugin now uses the exact binary names listed above.

---

## 🚀 The Genesis Workflow (First Use)

1. Open any Markdown note in your vault.
2. Click the **signature icon** (✍️) in the left ribbon, or use the command palette (`Ctrl/Cmd + P` → “Sign current note”).
3. A modal will appear showing your **Public Key**. Copy it – you will need to add it to your Project R.E.D. node’s `authors.json`.
4. Choose a **Knowledge Branch** from the dropdown (e.g., `Formal Sciences`).
5. Choose a **Sub‑Branch** (e.g., `Mathematics/Logic`) – the list adapts to your branch selection.
6. Click **Sign this note**.

**What happens under the hood:**
- If you are a new maintainer, the plugin generates your private key at `~/.red-network/maintainer.key` (strict `0600` permissions).
- It creates or locates `manifest.json` at the root of your vault.
- The manifest stores:
  ```json
  {
    "branch": "Formal Sciences",
    "sub_branch": "Mathematics/Logic",
    "branch_author": "your_public_key_hex",
    "files": { ... }
  }
  ```
- The `branch_author` field is set **once** – from that moment, **only you** can change the branch or sub‑branch for this vault. Any other user who tries will see a lock icon and receive a warning.
- The status bar will glow `✓ Signed` (green). If you modify even a single character, the hash changes and the status immediately reverts to `Unsigned` until you sign again.

---

## 🛡️ Security Architecture

- **The Private Key:** Your `maintainer.key` is stored at `~/.red-network/maintainer.key` (owner read/write only). **Never upload this or share it.**
- **The README:** A `README.md` is automatically created in the same folder, warning you about the consequences of deleting the key.
- **The Verification:** The Obsidian plugin only signs the files. Verification happens strictly on the Project R.E.D. Go server side, ensuring no compromised files are ever rendered to the end‑user.
- **Branch Author Lock:** Once a `branch_author` is set, the plugin disables the branch/sub‑branch dropdown for anyone whose public key does not match. This prevents tampering with classification after the vault is published.

---

## 💻 Building from Source (For Contributors)

If you want to audit or modify the plugin’s TypeScript architecture:

```bash
git clone https://github.com/StandardCodebase/obsidian-red-signer
cd obsidian-red-signer
npm install
npm run build   # or `npx tsc`
```

The compiled `main.js` will replace the existing one.

