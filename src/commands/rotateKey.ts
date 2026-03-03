// NexySync — Rotate Key Command

import * as vscode from 'vscode';
import * as api from '../services/api';
import { provisionKey, readKeyFile } from '../services/keyProvisioner';

export async function rotateKey(projectId: string, agentId: string, agentSlug: string): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        `Rotate API key for "${agentSlug}"?\n\nThis will immediately invalidate the current key. The .nexysync/key file will be automatically updated.`,
        { modal: true },
        'Rotate Key',
    );
    if (confirm !== 'Rotate Key') { return; }

    try {
        const result = await api.rotateAgentKey(projectId, agentId);

        // Auto-update .nexysync/key in the current workspace
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
            const existing = readKeyFile(ws);
            // Preserve agent_name from existing key file
            await provisionKey(ws, result.apiKey, existing?.agent_name, result.encKey);
            vscode.window.showInformationMessage(`✅ Key rotated! .nexysync/key updated for "${agentSlug}".`);
        } else {
            // No workspace — show the key for manual copy
            const action = await vscode.window.showInformationMessage(
                `✅ Key rotated!\n\nNew API Key: ${result.apiKey}\n\n⚠️ No workspace open — save this key manually.`,
                { modal: true },
                'Copy Key',
            );
            if (action === 'Copy Key') {
                await vscode.env.clipboard.writeText(result.apiKey);
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to rotate key: ${(err as Error).message}`);
    }
}
