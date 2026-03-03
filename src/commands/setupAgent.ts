// NexySync — Setup Agent Command
// "Setup Agent for This Workspace" — project picker → agent picker → write .nexysync/key

import * as vscode from 'vscode';
import * as api from '../services/api';
import { provisionWorkspace } from '../services/keyProvisioner';

export async function setupAgent(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        vscode.window.showErrorMessage('Open a workspace folder first.');
        return;
    }

    // Pick project
    let projects: any[];
    try {
        const result = await api.getProjects();
        projects = result.projects || [];
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to load projects: ${(err as Error).message}`);
        return;
    }

    if (projects.length === 0) {
        const create = await vscode.window.showInformationMessage(
            'No Projects found. Create one first?',
            'Create Project',
        );
        if (create === 'Create Project') {
            vscode.commands.executeCommand('nexysync.createProject');
        }
        return;
    }

    const projectPick = await vscode.window.showQuickPick(
        projects.map(p => ({ label: p.name, description: p.slug, id: p._id || p.id })),
        { placeHolder: 'Select Project' },
    );
    if (!projectPick) { return; }

    // Pick agent or create new
    let agents: any[];
    try {
        const result = await api.getAgents(projectPick.id);
        agents = result.agents || [];
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to load agents: ${(err as Error).message}`);
        return;
    }

    const items = [
        { label: '$(add) Create New Agent', id: '__new__', description: '' },
        ...agents.map(a => ({ label: a.name || a.slug, description: a.slug, id: a._id || a.id })),
    ];

    const agentPick = await vscode.window.showQuickPick(items, { placeHolder: 'Select agent' });
    if (!agentPick) { return; }

    let apiKey: string;
    let agentName: string;
    let encKey: string | undefined;

    if (agentPick.id === '__new__') {
        // Create new agent
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
            const result = await api.createAgent(projectPick.id, slug, name, role);
            apiKey = result.apiKey;
            encKey = result.encKey;
            agentName = name;

            // Show key in modal
            const copied = await vscode.window.showInformationMessage(
                `Agent created! API Key:\n\n${apiKey}\n\nThis key will NOT be shown again.`,
                { modal: true },
                'Copy Key',
            );
            if (copied === 'Copy Key') {
                await vscode.env.clipboard.writeText(apiKey);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to create agent: ${(err as Error).message}`);
            return;
        }
    } else {
        // Existing agent — need to rotate key to get a raw key
        const rotate = await vscode.window.showWarningMessage(
            'To provision an existing agent, a new key must be generated (the current key will be invalidated).',
            { modal: true },
            'Generate New Key',
        );
        if (rotate !== 'Generate New Key') { return; }

        try {
            const result = await api.rotateAgentKey(projectPick.id, agentPick.id);
            apiKey = result.apiKey;
            encKey = result.encKey;
            agentName = agentPick.label;
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to rotate key: ${(err as Error).message}`);
            return;
        }
    }

    // Write .nexysync/key + install agent skill
    await provisionWorkspace(ws, apiKey, agentName, encKey);
}
