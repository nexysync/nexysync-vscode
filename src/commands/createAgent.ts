// NexySync — Create Agent Command

import * as vscode from 'vscode';
import * as api from '../services/api';

export async function createAgent(projectId?: string): Promise<void> {
    // If no projectId passed, ask user to pick
    if (!projectId) {
        try {
            const result = await api.getProjects();
            const projects = result.projects || [];
            if (projects.length === 0) {
                vscode.window.showErrorMessage('Create a Project first.');
                return;
            }
            const pick = await vscode.window.showQuickPick(
                projects.map((p: any) => ({ label: p.name, description: p.slug, id: p._id || p.id })),
                { placeHolder: 'Select Project for new agent' },
            );
            if (!pick) { return; }
            projectId = pick.id;
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to load Projects: ${(err as Error).message}`);
            return;
        }
    }

    const slug = await vscode.window.showInputBox({
        prompt: 'Agent slug (lowercase, hyphens)',
        placeHolder: 'my-agent',
        ignoreFocusOut: true,
        validateInput: (v) => /^[a-z0-9-]+$/.test(v) ? undefined : 'Lowercase letters, numbers, and hyphens only',
    });
    if (!slug) { return; }

    const name = await vscode.window.showInputBox({
        prompt: 'Agent display name',
        placeHolder: 'My Agent',
        ignoreFocusOut: true,
    });
    if (!name) { return; }

    const role = await vscode.window.showInputBox({
        prompt: 'Agent role (optional)',
        placeHolder: 'Backend developer',
    });

    try {
        const result = await api.createAgent(projectId!, slug, name, role);

        // Show key in modal — default action is Setup Workspace (first button)
        const action = await vscode.window.showInformationMessage(
            `✅ Agent "${name}" created!\n\nAPI Key: ${result.apiKey}\n\n⚠️ This key will NOT be shown again.`,
            { modal: true },
            'Setup Workspace',
            'Copy Key Only',
        );

        if (action === 'Copy Key Only') {
            await vscode.env.clipboard.writeText(result.apiKey);
            vscode.window.showInformationMessage('API key copied to clipboard');
        }

        if (action === 'Setup Workspace') {
            await vscode.env.clipboard.writeText(result.apiKey);
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (ws) {
                const { provisionWorkspace } = await import('../services/keyProvisioner');
                await provisionWorkspace(ws, result.apiKey, name);
            } else {
                vscode.window.showInformationMessage('API key copied to clipboard (no workspace open for setup)');
            }
        }
    } catch (err) {
        if (err instanceof api.ApiError) {
            vscode.window.showErrorMessage(`Failed: ${err.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to create agent');
        }
    }
}
