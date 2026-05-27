package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ManifestEntry struct {
	FileHash  string `json:"file_hash"`
	PublicKey string `json:"public_key"`
	Signature string `json:"signature"`
}

func main() {
	manifestFlag := flag.String("manifest", "", "Explicit path to manifest.json (optional)")
	initFlag := flag.Bool("init", false, "Initialize a brand new manifest in the current directory")
	printPubKeyFlag := flag.Bool("print-pubkey", false, "Print the current public key and exit")
	flag.Parse()

	// Use global home directory to prevent key exposure via vault syncing tools
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Cannot find home dir: %v\n", err)
		os.Exit(1)
	}
	keyDir := filepath.Join(homeDir, ".red-network")
	keyPath := filepath.Join(keyDir, "maintainer.key")
	pubKeyPath := filepath.Join(keyDir, "maintainer.pub")

	// Special mode: print public key from existing private key
	if *printPubKeyFlag {
		privKey, err := loadPrivateKey(keyPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[ERROR] %v\n", err)
			os.Exit(1)
		}
		pubKey := privKey.Public().(ed25519.PublicKey)
		fmt.Println(hex.EncodeToString(pubKey))
		return
	}

	args := flag.Args()
	if len(args) != 1 {
		fmt.Fprintf(os.Stderr, "Usage: %s [flags] <markdown-file>\n", os.Args[0])
		flag.PrintDefaults()
		os.Exit(1)
	}
	markdownPath := args[0]

	// Read and hash file
	fileBytes, err := os.ReadFile(markdownPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Cannot read markdown file: %v\n", err)
		os.Exit(1)
	}
	hash := sha256.Sum256(fileBytes)
	hashHex := hex.EncodeToString(hash[:])

	// --- Key management ---
	if err := os.MkdirAll(keyDir, 0700); err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Cannot create key dir: %v\n", err)
		os.Exit(1)
	}

	var privKey ed25519.PrivateKey
	var pubKey ed25519.PublicKey

	keyBytes, err := os.ReadFile(keyPath)
	if err == nil && len(keyBytes) == ed25519.PrivateKeySize {
		privKey = ed25519.PrivateKey(keyBytes)
		pubKey = privKey.Public().(ed25519.PublicKey)
		fmt.Fprintln(os.Stderr, "[SYS] Loaded existing identity.")

		pubKeyHex := hex.EncodeToString(pubKey)
		if err := os.WriteFile(pubKeyPath, []byte(pubKeyHex), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "[WARN] Could not write public key file: %v\n", err)
		}
	} else {
		fmt.Fprintln(os.Stderr, "[SYS] Generating new identity...")
		pubKey, privKey, err = ed25519.GenerateKey(rand.Reader)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[ERROR] Key generation failed: %v\n", err)
			os.Exit(1)
		}
		if err := os.WriteFile(keyPath, privKey, 0600); err != nil {
			fmt.Fprintf(os.Stderr, "[ERROR] Cannot save private key: %v\n", err)
			os.Exit(1)
		}
		pubKeyHex := hex.EncodeToString(pubKey)
		if err := os.WriteFile(pubKeyPath, []byte(pubKeyHex), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "[WARN] Could not save public key file: %v\n", err)
		}
		fmt.Fprintf(os.Stderr, "[NEW IDENTITY] Public key (add to TrustedMaintainers):\n%s\n", pubKeyHex)
	}

	// Sign
	signature := ed25519.Sign(privKey, hash[:])

	// --- Manifest handling ---
	absMarkdownPath, _ := filepath.Abs(markdownPath)
	manifestPath := *manifestFlag

	if manifestPath == "" {
		manifestPath, err = findManifest(absMarkdownPath)
		if err != nil {
			if *initFlag {
				cwd, _ := os.Getwd()
				manifestPath = filepath.Join(cwd, "manifest.json")
				fmt.Fprintf(os.Stderr, "[SYS] Creating new manifest at: %s\n", manifestPath)
			} else {
				fmt.Fprintf(os.Stderr, "[ERROR] No manifest.json found. Use --init to create one.\n")
				os.Exit(1)
			}
		}
	}

	relPath, err := filepath.Rel(filepath.Dir(manifestPath), absMarkdownPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Cannot compute relative path: %v\n", err)
		os.Exit(1)
	}

	// FIX: Path Traversal Prevention
	relPath = filepath.Clean(relPath)
	if strings.HasPrefix(relPath, "..") {
		fmt.Fprintf(os.Stderr, "[ERROR] Markdown file is outside the manifest directory boundary: %s\n", relPath)
		os.Exit(1)
	}

	mapKey := filepath.ToSlash(relPath)

	if err := atomicUpdateManifest(manifestPath, mapKey, hashHex,
		hex.EncodeToString(pubKey), hex.EncodeToString(signature)); err != nil {
		fmt.Fprintf(os.Stderr, "[ERROR] Failed to update manifest: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("[SUCCESS] Signed %s\n", mapKey)
}

// loadPrivateKey reads the private key from disk
func loadPrivateKey(path string) (ed25519.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read private key: %v", err)
	}
	if len(data) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size")
	}
	return ed25519.PrivateKey(data), nil
}

// findManifest walks up from startPath looking for manifest.json
func findManifest(startPath string) (string, error) {
	dir := filepath.Dir(startPath)
	for {
		candidate := filepath.Join(dir, "manifest.json")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("no manifest.json found")
		}
		dir = parent
	}
}

// atomicUpdateManifest writes the manifest to a temp file then renames.
func atomicUpdateManifest(manifestPath, key, hashHex, pubKeyHex, sigHex string) error {
	manifest := make(map[string]ManifestEntry)
	data, err := os.ReadFile(manifestPath)
	if err == nil {
		if err := json.Unmarshal(data, &manifest); err != nil {
			return fmt.Errorf("manifest.json corrupted: %v", err)
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	manifest[key] = ManifestEntry{
		FileHash:  hashHex,
		PublicKey: pubKeyHex,
		Signature: sigHex,
	}

	updatedData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(manifestPath)
	tmpFile, err := os.CreateTemp(dir, "manifest.*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(updatedData); err != nil {
		tmpFile.Close()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}

	return os.Rename(tmpPath, manifestPath)
}
