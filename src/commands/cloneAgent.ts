// NexySync — Clone Agent Command

import * as vscode from 'vscode';
import * as api from '../services/api';

export async function cloneAgent(projectId: string, agentId: string, agentSlug: string): Promise<void> {
    // Pick target project
    let projects: any[];
    try {
        const result = await api.getProjects();
        projects = (result.projects || []).filter((p: any) => (p._id || p.id) !== projectId);
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to load Projects: ${(err as Error).message}`);
        return;
    }

    if (projects.length === 0) {
        vscode.window.showErrorMessage('No other Projects to clone to. Create another Project first.');
        return;
    }

    const pick = await vscode.window.showQuickPick(
        projects.map((p: any) => ({ label: p.name, description: p.slug, id: p._id || p.id })),
        { placeHolder: `Clone "${agentSlug}" to which Project?` },
    );
    if (!pick) { return; }

    try {
        const result = await api.cloneAgent(projectId, agentId, pick.id);

        const action = await vscode.window.showInformationMessage(
            `✅ Agent "${agentSlug}" cloned to ${pick.label}!\n\nNew API Key: ${result.apiKey}\n\n⚠️ This key will NOT be shown again.`,
            { modal: true },
            'Copy Key',
        );
        if (action === 'Copy Key') {
            await vscode.env.clipboard.writeText(result.apiKey);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to clone agent: ${(err as Error).message}`);
    }
}
