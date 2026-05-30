"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const crypto_1 = require("crypto");
const execFilePromise = (0, util_1.promisify)(child_process_1.execFile);
// --- Predefined sub‑branch options per branch ---
const subBranchOptions = {
    "Formal Sciences": ["Logic", "Mathematics", "Computer Science", "Statistics", "Information Theory"],
    "Physical Sciences": ["Physics", "Chemistry", "Astronomy", "Earth Sciences", "Materials Science"],
    "Social Sciences": ["Sociology", "Psychology", "Economics", "Political Science", "Anthropology"],
    "Applied Sciences": ["Engineering", "Medicine", "Agriculture", "Architecture", "Technology", "Cryptography"],
    "Arts & Humanities": ["Literature", "History", "Philosophy", "Visual Arts", "Music", "Theatre"],
    "Philosophy & Ethics": ["Epistemology", "Metaphysics", "Ethics", "Aesthetics", "Logic"]
};
// --- Modal with branch and sub‑branch selection ---
class SignModal extends obsidian_1.Modal {
    constructor(app, plugin, file) {
        super(app);
        this.publicKey = null;
        this.isAuthor = false;
        this.plugin = plugin;
        this.file = file;
    }
    async onOpen() {
        this.publicKey = await this.plugin.getPublicKey();
        this.isAuthor = await this.plugin.isBranchAuthor();
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Red Signer" });
        if (!this.file) {
            contentEl.createEl("p", { text: "No markdown file is currently active." });
            return;
        }
        contentEl.createEl("h3", { text: `Current file: ${this.file.name}` });
        contentEl.createEl("h4", { text: "Your Public Key:" });
        const keyContainer = contentEl.createDiv({ cls: "red-signer-key-container" });
        if (this.publicKey) {
            const keyText = keyContainer.createEl("code", { text: this.publicKey });
            keyText.style.cssText = "word-break:break-all; display:block; margin:0.5em 0; padding:0.5em; background:#f0f0f0; border-radius:4px;";
            const copyBtn = keyContainer.createEl("button", { text: "Copy to Clipboard" });
            copyBtn.onclick = async () => {
                await navigator.clipboard.writeText(this.publicKey);
                new obsidian_1.Notice("Public key copied!");
            };
        }
        else {
            keyContainer.createEl("p", { text: "No public key found. Sign a note first to generate one." });
        }
        // --- Branch selection (only if author) ---
        contentEl.createEl("h4", { text: "Knowledge Branch" });
        const branchSelect = contentEl.createEl("select");
        const branches = Object.keys(subBranchOptions);
        const currentBranch = this.plugin.currentBranch;
        for (const b of branches) {
            const option = branchSelect.createEl("option", { text: b });
            if (currentBranch === b)
                option.selected = true;
        }
        if (!this.isAuthor)
            branchSelect.disabled = true;
        // --- Sub‑branch dropdown (dynamic based on branch) ---
        contentEl.createEl("h4", { text: "Sub‑Branch" });
        const subBranchSelect = contentEl.createEl("select");
        const updateSubBranchOptions = () => {
            const selectedBranch = branchSelect.value;
            const options = subBranchOptions[selectedBranch] || ["General"];
            subBranchSelect.empty();
            for (const opt of options) {
                const option = subBranchSelect.createEl("option", { text: opt });
                if (this.plugin.currentSubBranch === opt)
                    option.selected = true;
            }
        };
        updateSubBranchOptions();
        branchSelect.addEventListener("change", updateSubBranchOptions);
        if (!this.isAuthor)
            subBranchSelect.disabled = true;
        if (!this.isAuthor && this.plugin.currentBranch) {
            contentEl.createEl("p", { text: "🔒 Classification locked by original author.", cls: "red-signer-lock" });
        }
        const signBtn = contentEl.createEl("button", { text: "✍️ Sign this note", cls: "mod-cta" });
        signBtn.style.marginTop = "1em";
        signBtn.onclick = async () => {
            signBtn.disabled = true;
            signBtn.setText("Signing...");
            if (this.isAuthor) {
                const newBranch = branchSelect.value;
                const newSubBranch = subBranchSelect.value;
                await this.plugin.updateManifestBranch(newBranch, newSubBranch);
            }
            await this.plugin.signFile(this.file);
            this.close();
        };
        const closeBtn = contentEl.createEl("button", { text: "Close" });
        closeBtn.style.marginLeft = "0.5em";
        closeBtn.onclick = () => this.close();
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
// --- Main Plugin Class ---
class RedSignerPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.binaryPath = "";
        this.pluginDir = "";
        this.vaultRoot = "";
        this.statusBarItem = null;
        this.currentBranch = "";
        this.currentSubBranch = "";
    }
    async onload() {
        this.vaultRoot = this.app.vault.adapter.getBasePath();
        if (!this.vaultRoot) {
            new obsidian_1.Notice("❌ This plugin only works on desktop Obsidian.");
            return;
        }
        const manifestDir = this.manifest.dir || "";
        this.pluginDir = path.join(this.vaultRoot, manifestDir);
        let binaryName;
        switch (process.platform) {
            case "win32":
                binaryName = "signer-windows-x64.exe";
                break;
            case "darwin":
                binaryName = process.arch === "arm64" ? "signer-macos-arm64" : "signer-macos-x64";
                break;
            case "linux":
                binaryName = "signer-linux-x64";
                break;
            default:
                binaryName = "signer";
        }
        this.binaryPath = path.join(this.pluginDir, binaryName);
        if (process.platform !== "win32" && fs.existsSync(this.binaryPath)) {
            try {
                const stats = fs.statSync(this.binaryPath);
                if (!(stats.mode & 0o111)) {
                    fs.chmodSync(this.binaryPath, 0o755);
                    console.log(`Set executable permission on ${this.binaryPath}`);
                }
            }
            catch (err) {
                console.warn(`Could not set executable permission: ${err}`);
            }
        }
        if (!fs.existsSync(this.binaryPath)) {
            new obsidian_1.Notice(`❌ Signer binary missing at ${this.binaryPath}`, 0);
            console.error(`Missing: ${this.binaryPath}`);
        }
        // Ensure README in the key directory
        this.ensureReadme().catch(console.error);
        await this.loadBranchFromManifest();
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass("red-signer-status");
        this.updateStatusForActiveFile();
        this.registerEvent(this.app.vault.on("modify", (file) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && file === activeFile)
                this.updateStatusForActiveFile();
        }));
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
            this.updateStatusForActiveFile();
        }));
        this.addRibbonIcon("signature", "Red Signer: Sign current note", async () => {
            const file = this.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                new SignModal(this.app, this, file).open();
            }
            else {
                new obsidian_1.Notice("Please open a markdown note first.");
            }
        });
        this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
            const file = view.file;
            if (file && file.extension === "md") {
                menu.addItem((item) => {
                    item.setTitle("Sign this note directly")
                        .setIcon("checkmark")
                        .onClick(async () => { await this.signFile(file); });
                });
            }
        }));
        this.addCommand({
            id: "sign-current-note",
            name: "Sign current note",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.extension === "md") {
                    if (!checking)
                        this.signFile(file);
                    return true;
                }
                return false;
            },
        });
        this.addCommand({
            id: "copy-public-key",
            name: "Copy public key to clipboard",
            callback: () => this.copyPublicKey(),
        });
    }
    async ensureReadme() {
        const homedir = require('os').homedir();
        const redNetworkDir = path.join(homedir, ".red-network");
        const readmePath = path.join(redNetworkDir, "README.md");
        if (!fs.existsSync(readmePath)) {
            if (!fs.existsSync(redNetworkDir)) {
                fs.mkdirSync(redNetworkDir, { recursive: true, mode: 0o700 });
            }
            const content = `# RED Network Identity
  
This directory contains your private Ed25519 key (maintainer.key) used by the Red Signer Obsidian plugin.

**⚠️ WARNING: Do not delete this file unless you intend to lose your contributor identity.**

- If you delete maintainer.key, you will no longer be able to sign notes as the original author of any vault.
- You will lose the ability to modify branch classification for vaults you authored.
- A new key will be generated automatically, but it will be a different identity.

To back up your identity, copy the file maintainer.key to a secure location (e.g., an encrypted USB drive).

For more information, see https://github.com/RED-Collective/red-engine
        `;
            fs.writeFileSync(readmePath, content, { mode: 0o644 });
            console.log("Created README in ~/.red-network");
        }
    }
    async loadBranchFromManifest() {
        const manifestPath = path.join(this.vaultRoot, "manifest.json");
        try {
            const data = await fs.promises.readFile(manifestPath, "utf8");
            const manifest = JSON.parse(data);
            this.currentBranch = manifest.branch || "";
            this.currentSubBranch = manifest.sub_branch || "";
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Failed to read manifest for branch info:", err);
            }
            this.currentBranch = "";
            this.currentSubBranch = "";
        }
    }
    async isBranchAuthor() {
        const manifestPath = path.join(this.vaultRoot, "manifest.json");
        try {
            const data = await fs.promises.readFile(manifestPath, "utf8");
            const manifest = JSON.parse(data);
            const authorPubKey = manifest.branch_author;
            if (!authorPubKey)
                return true;
            const currentPubKey = await this.getPublicKey();
            return currentPubKey === authorPubKey;
        }
        catch (err) {
            if (err.code === "ENOENT")
                return true;
            console.error("Error checking branch author:", err);
            return false;
        }
    }
    async updateManifestBranch(branch, subBranch) {
        const isAuthor = await this.isBranchAuthor();
        if (!isAuthor) {
            new obsidian_1.Notice("❌ Only the original author can change the branch classification.");
            return false;
        }
        const manifestPath = path.join(this.vaultRoot, "manifest.json");
        let manifest = { files: {} };
        try {
            const data = await fs.promises.readFile(manifestPath, "utf8");
            manifest = JSON.parse(data);
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                new obsidian_1.Notice(`Failed to read manifest: ${err.message}`);
                return false;
            }
        }
        const oldBranch = manifest.branch || "(none)";
        const oldSub = manifest.sub_branch || "(none)";
        const confirmMsg = `Change classification from\nBranch: ${oldBranch}\nSub‑branch: ${oldSub}\nto\nBranch: ${branch}\nSub‑branch: ${subBranch} ?\n\nThis will affect the entire vault.`;
        if (!confirm(confirmMsg))
            return false;
        manifest.branch = branch;
        manifest.sub_branch = subBranch;
        if (!manifest.branch_author) {
            const currentPubKey = await this.getPublicKey();
            if (currentPubKey)
                manifest.branch_author = currentPubKey;
        }
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        this.currentBranch = branch;
        this.currentSubBranch = subBranch;
        new obsidian_1.Notice("✅ Branch classification updated.");
        return true;
    }
    async updateStatusForActiveFile() {
        var _a;
        if (!this.statusBarItem)
            return;
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
            this.statusBarItem.setText("");
            return;
        }
        const manifestPath = path.join(this.vaultRoot, "manifest.json");
        const mapKey = file.path;
        try {
            const data = await fs.promises.readFile(manifestPath, "utf8");
            const manifest = JSON.parse(data);
            const entry = (_a = manifest.files) === null || _a === void 0 ? void 0 : _a[mapKey];
            if (!entry) {
                this.showUnsigned();
                return;
            }
            const content = await this.app.vault.readBinary(file);
            const hash = (0, crypto_1.createHash)("sha256").update(Buffer.from(content)).digest("hex");
            if (hash === entry.file_hash) {
                this.statusBarItem.setText("✓ Signed");
                this.statusBarItem.style.color = "var(--color-green)";
            }
            else {
                this.showUnsigned();
            }
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Status check error:", err);
            }
            this.showUnsigned();
        }
    }
    showUnsigned() {
        if (!this.statusBarItem)
            return;
        this.statusBarItem.setText("Unsigned");
        this.statusBarItem.style.color = "var(--text-muted)";
    }
    async signFile(file) {
        if (!fs.existsSync(this.binaryPath)) {
            new obsidian_1.Notice(`❌ Signer binary missing at ${this.binaryPath}`);
            return;
        }
        const fullPath = this.app.vault.adapter.getFullPath(file.path);
        if (!fullPath) {
            new obsidian_1.Notice("❌ Cannot get file path.");
            return;
        }
        const manifestPath = path.join(this.vaultRoot, "manifest.json");
        console.log(`Using manifest: ${manifestPath}`);
        new obsidian_1.Notice(`🔏 Signing ${file.name}...`);
        try {
            const { stdout, stderr } = await execFilePromise(this.binaryPath, [
                `--manifest=${manifestPath}`,
                fullPath,
            ]);
            if (stderr)
                console.warn(stderr);
            console.log(stdout);
            new obsidian_1.Notice(`✅ Signed: ${file.name}`);
            await this.showPublicKeyIfNew();
            await this.updateStatusForActiveFile();
        }
        catch (error) {
            const errorMsg = error.message + (error.stderr || "");
            if (errorMsg.includes("--init") || errorMsg.includes("no manifest.json")) {
                new obsidian_1.Notice(`📄 Creating manifest at ${manifestPath}...`);
                const args = ["--init", `--manifest=${manifestPath}`];
                if (this.currentBranch)
                    args.push(`--branch=${this.currentBranch}`);
                if (this.currentSubBranch)
                    args.push(`--sub-branch=${this.currentSubBranch}`);
                args.push(fullPath);
                try {
                    const { stdout, stderr } = await execFilePromise(this.binaryPath, args);
                    if (stderr)
                        console.warn(stderr);
                    console.log(stdout);
                    new obsidian_1.Notice(`✅ Signed after manifest init: ${file.name}`);
                    await this.showPublicKeyIfNew();
                    await this.updateStatusForActiveFile();
                }
                catch (retryError) {
                    new obsidian_1.Notice(`❌ Still failed: ${retryError.message}`);
                    console.error(retryError);
                }
            }
            else {
                new obsidian_1.Notice(`❌ Signing failed: ${error.message}`);
                console.error(error);
            }
        }
    }
    async initManifest(manifestPath) {
        const args = ["--init", `--manifest=${manifestPath}`];
        if (this.currentBranch)
            args.push(`--branch=${this.currentBranch}`);
        if (this.currentSubBranch)
            args.push(`--sub-branch=${this.currentSubBranch}`);
        try {
            const { stderr } = await execFilePromise(this.binaryPath, args);
            if (stderr)
                console.warn(stderr);
            new obsidian_1.Notice(`✅ Manifest created at ${manifestPath}`);
        }
        catch (err) {
            new obsidian_1.Notice(`❌ Failed to create manifest: ${err.message}`);
            console.error(err);
        }
    }
    async showPublicKeyIfNew() {
        const pubKey = await this.getPublicKey();
        if (pubKey) {
            const flagPath = path.join(this.pluginDir, ".pubkey_shown");
            if (!fs.existsSync(flagPath)) {
                new obsidian_1.Notice(`🔑 Your public key:\n${pubKey}\nAdd this to TrustedMaintainers on server.`, 10000);
                fs.writeFileSync(flagPath, pubKey);
            }
        }
    }
    async getPublicKey() {
        if (!fs.existsSync(this.binaryPath))
            return null;
        try {
            const { stdout } = await execFilePromise(this.binaryPath, ["--print-pubkey"]);
            return stdout.trim();
        }
        catch (err) {
            return null;
        }
    }
    async copyPublicKey() {
        const pubKey = await this.getPublicKey();
        if (pubKey) {
            await navigator.clipboard.writeText(pubKey);
            new obsidian_1.Notice("📋 Public key copied to clipboard.");
        }
        else {
            new obsidian_1.Notice("❌ No public key found. Sign a note first to generate one.");
        }
    }
    onunload() { }
}
exports.default = RedSignerPlugin;
