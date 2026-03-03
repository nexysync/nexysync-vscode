// NexySync — Status Bar
// Shows current connection status and active agent

import * as vscode from 'vscode';
import * as auth from './auth/AuthProvider';
import { readKeyFile } from './services/keyProvisioner';

let _statusBarItem: vscode.StatusBarItem;

export function createStatusBar(): vscode.StatusBarItem {
    _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    _statusBarItem.command = 'nexysync.login';
    updateStatusBar();

    auth.onDidChangeAuthState(() => updateStatusBar());

    return _statusBarItem;
}

export function updateStatusBar(): void {
    if (!_statusBarItem) { return; }

    if (auth.getState() === 'logged-in') {
        // Check workspace for active agent
        const ws = vscode.workspace.workspaceFolders?.[0];
        const keyFile = ws ? readKeyFile(ws) : undefined;

        if (keyFile) {
            const agentName = (keyFile as any).agent_name || parseAgentSlug(keyFile.api_key);
            _statusBarItem.text = `$(zap) NexySync: ${agentName}`;
            _statusBarItem.tooltip = `NexySync — Agent "${agentName}" configured. Click to manage.`;
            _statusBarItem.color = new vscode.ThemeColor('charts.green');
        } else {
            _statusBarItem.text = '$(zap) NexySync: No Agent';
            _statusBarItem.tooltip = 'NexySync — Logged in. No agent in this workspace.';
            _statusBarItem.color = new vscode.ThemeColor('charts.yellow');
        }
        _statusBarItem.command = 'nexysync.dashboard';
    } else {
        _statusBarItem.text = '$(zap) NexySync: Not connected';
        _statusBarItem.tooltip = 'Click to login to NexySync';
        _statusBarItem.color = undefined;
        _statusBarItem.command = 'nexysync.login';
    }

    _statusBarItem.show();
}

/**
 * Extract agent display name from API key.
 * Key format: nsync_{slug}_{hex}
 * Returns the slug portion, formatted as a title.
 * e.g. "nsync_hive_f7ed..." -> "hive"
 *      "nsync_nexysync-cdn_abc..." -> "nexysync-cdn"
 */
function parseAgentSlug(apiKey: string): string {
    // Format: nsync_{slug}_{40-char-hex}
    const parts = apiKey.split('_');
    if (parts.length >= 3 && parts[0] === 'nsync') {
        // Slug is everything between first and last underscore-separated parts
        // Last part is the hex token (40+ chars)
        const hexPart = parts[parts.length - 1];
        if (hexPart.length >= 32) {
            // Slug is parts[1] through parts[length-2]
            return parts.slice(1, -1).join('-');
        }
    }
    // Fallback — show shortened key
    return apiKey.substring(0, 16) + '…';
}
