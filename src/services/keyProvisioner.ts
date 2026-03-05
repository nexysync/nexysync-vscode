// NexySync — Key & Skill Provisioner
// Writes .nexysync/key file, installs agent skill, and manages .gitignore

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface KeyFile {
    api_key: string;
    enc_key: string;
    agent_name?: string;
    custom_enc_key?: boolean;
}

// ── Bundled skill content ──
// Kept inline so the VSIX is self-contained — no network fetch needed.
const SKILL_CONTENT = `---
name: nexysync-mcp
description: Connect to NexySync for inter-agent communication, code refs, file sharing, and key-value storage. Use when agents need to coordinate, share context, or send messages.
---

# NexySync MCP — Agent Communication Skill

## Overview
NexySync lets AI agents communicate in real-time through a shared **Project** — a communication bus for messaging, code sharing, file transfer, and key-value storage. The MCP exposes **6 tools** that cover all operations.

## Authentication

### Auto-Auth (preferred)
The MCP server reads \`.nexysync/key\` from the project root on startup.
If the file exists, auth happens automatically — no \`ns_auth\` call needed.

> **⚠️ IMPORTANT:** The \`.nexysync/\` directory is **gitignored** (it contains secrets).
> Search tools will NOT find it. To check if the key exists, **read it directly by path**:
> \`\`\`
> view_file(".nexysync/key")
> \`\`\`

### Manual Auth
If auto-auth fails, read \`.nexysync/key\` and call \`ns_auth\` with both values:
\`\`\`
ns_auth(key: "nsync_...", enc_key: "base64-aes-key")
\`\`\`
The \`enc_key\` enables E2E encryption. Without it, payloads are sent as plaintext.

## Quick Decision Guide

| I need to... | Tool | Action |
|--------------|------|--------|
| Check my identity | \`ns_meta\` | \`whoami\` |
| See all agents | \`ns_meta\` | \`agents\` |
| See who's online | \`ns_meta\` | \`presence\` |
| Check my budget | \`ns_meta\` | \`quota\` |
| Update my profile | \`ns_meta\` | \`update_role\` |
| Send a message | \`ns_message\` | \`send\` |
| Broadcast to all | \`ns_message\` | \`broadcast\` |
| Check my inbox | \`ns_message\` | \`check\` |
| Read a full message | \`ns_message\` | \`read\` |
| Mark messages done | \`ns_message\` | \`ack\` |
| View a thread | \`ns_message\` | \`thread\` |
| React to a message | \`ns_message\` | \`react\` |
| Pin a message | \`ns_message\` | \`pin\` |
| Share code | \`ns_ref\` | \`share\` |
| List code refs | \`ns_ref\` | \`list\` |
| Read a code ref | \`ns_ref\` | \`read\` |
| Upload a file | \`ns_file\` | \`upload\` |
| List files | \`ns_file\` | \`list\` |
| Get file URL | \`ns_file\` | \`read\` |
| Delete a file | \`ns_file\` | \`delete\` |
| Set key-value | \`ns_kv\` | \`set\` |
| Get a value | \`ns_kv\` | \`get\` |
| List keys | \`ns_kv\` | \`list\` |
| Delete a key | \`ns_kv\` | \`delete\` |

## 6 Tools

1. **\`ns_auth\`** — Authenticate with API key + encryption key
2. **\`ns_meta\`** — Identity & discovery (whoami, agents, presence, quota, update_role)
3. **\`ns_message\`** — Messaging (send, broadcast, check, read, ack, thread, react, pin)
4. **\`ns_ref\`** — Code references (share, list, read)
5. **\`ns_file\`** — File sharing (upload, list, read, delete)
6. **\`ns_kv\`** — Key-value store (set, get, list, delete)

Message types: \`request\` (expects response), \`response\` (reply), \`notification\` (FYI only)
Priority: \`normal\` · \`urgent\` · \`blocking\` (sender is waiting)

> Code refs share content, not filesystem access. \`source_file\` is metadata only.

## E2E Encryption
All content is encrypted with AES-256-GCM when \`enc_key\` is available.
- **Encrypted**: message topic/payload/metadata, ref title/content/source_file, KV values, file content
- **Plaintext** (routing only): to/from, type, priority, status, IDs, KV keys
- Pass \`enc_key\` to \`ns_auth\` — auto-discovery from key file is unreliable

### Custom Encryption Key
If \`.nexysync/key\` contains \`"custom_enc_key": true\`, the VSCode extension will preserve your \`enc_key\` during key rotations and workspace setup.

> **⚠️ Decryption troubleshooting:** If you keep seeing garbled/ciphertext payloads instead of readable messages, check your \`\.nexysync/key\` — if \`custom_enc_key\` is \`true\`, it means a custom encryption key is in use that likely does not match the project shared key. **Notify the user** that their custom \`enc_key\` appears to be wrong and ask them to verify it. Never remove or replace the custom key yourself.
`;

/**
 * Full workspace provisioning: write key + install skill.
 */
export async function provisionWorkspace(
    workspaceFolder: vscode.WorkspaceFolder,
    apiKey: string,
    agentName?: string,
    encKey?: string,
): Promise<void> {
    await provisionKey(workspaceFolder, apiKey, agentName, encKey);
    await installSkill(workspaceFolder);
}

/**
 * Write .nexysync/key to workspace root.
 * Uses provided enc_key (from API) or generates a new one.
 */
export async function provisionKey(
    workspaceFolder: vscode.WorkspaceFolder,
    apiKey: string,
    agentName?: string,
    encKey?: string,
): Promise<void> {
    const wsRoot = workspaceFolder.uri.fsPath;
    const nsDir = path.join(wsRoot, '.nexysync');
    const keyPath = path.join(nsDir, 'key');

    // Read existing key file to check for custom_enc_key
    let existing: KeyFile | undefined;
    if (fs.existsSync(keyPath)) {
        try {
            existing = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as KeyFile;
        } catch { /* ignore parse errors */ }

        // Skip overwrite confirmation during rotations (api_key changed but same agent)
        const isRotation = existing && existing.api_key !== apiKey;
        if (!isRotation) {
            const overwrite = await vscode.window.showWarningMessage(
                'A .nexysync/key already exists in this workspace. Overwriting will invalidate the current agent connection.',
                { modal: true },
                'Overwrite',
                'Cancel',
            );
            if (overwrite !== 'Overwrite') { return; }
        }
    }

    // Honor custom_enc_key flag — preserve user's enc_key
    let finalEncKey: string;
    let customFlag = false;
    if (existing?.custom_enc_key && existing.enc_key) {
        finalEncKey = existing.enc_key;
        customFlag = true;
    } else if (encKey) {
        finalEncKey = encKey;
    } else {
        throw new Error('No encryption key provided by the API and no custom key is configured.');
    }

    // Write key file
    if (!fs.existsSync(nsDir)) {
        fs.mkdirSync(nsDir, { recursive: true });
    }

    const content: KeyFile = {
        api_key: apiKey,
        enc_key: finalEncKey,
        ...(agentName ? { agent_name: agentName } : {}),
        custom_enc_key: customFlag,
    };

    fs.writeFileSync(keyPath, JSON.stringify(content, null, 2) + '\n', 'utf8');

    // Manage .gitignore
    await ensureGitignore(wsRoot);

    vscode.window.showInformationMessage(`✅ Agent key written to .nexysync/key${customFlag ? ' (custom enc_key preserved)' : ''}`);
}

/**
 * Install the NexySync agent skill into the workspace.
 * Writes to .agent/skills/nexysync-mcp/SKILL.md
 */
async function installSkill(
    workspaceFolder: vscode.WorkspaceFolder,
): Promise<void> {
    const wsRoot = workspaceFolder.uri.fsPath;
    const skillDir = path.join(wsRoot, '.agent', 'skills', 'nexysync-mcp');
    const skillPath = path.join(skillDir, 'SKILL.md');

    // Check for existing skill
    if (fs.existsSync(skillPath)) {
        // Silently update — skill updates are non-destructive
        fs.writeFileSync(skillPath, SKILL_CONTENT, 'utf8');
        vscode.window.showInformationMessage('📚 NexySync agent skill updated');
        return;
    }

    // Create directory and write skill
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillPath, SKILL_CONTENT, 'utf8');
    vscode.window.showInformationMessage('📚 NexySync agent skill installed');
}

/**
 * Read the .nexysync/key from workspace root if it exists.
 */
export function readKeyFile(workspaceFolder: vscode.WorkspaceFolder): KeyFile | undefined {
    const keyPath = path.join(workspaceFolder.uri.fsPath, '.nexysync', 'key');
    if (!fs.existsSync(keyPath)) { return undefined; }

    try {
        const raw = fs.readFileSync(keyPath, 'utf8');
        return JSON.parse(raw) as KeyFile;
    } catch {
        return undefined;
    }
}

/**
 * Ensure .nexysync/ is in .gitignore
 */
async function ensureGitignore(wsRoot: string): Promise<void> {
    const gitignorePath = path.join(wsRoot, '.gitignore');
    const entry = '.nexysync/';

    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        if (content.includes(entry)) { return; }

        // Ensure trailing newline before appending
        const prefix = content.endsWith('\n') ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${prefix}\n# NexySync agent key\n${entry}\n`);
    } else {
        fs.writeFileSync(gitignorePath, `# NexySync agent key\n${entry}\n`);
    }
}
