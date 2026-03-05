// NexySync — VS Code Extension Entry Point
// Registers all commands, views, and status bar

import * as vscode from 'vscode';
import { initApiClient } from './services/api';
import * as auth from './auth/AuthProvider';
import { ProjectsViewProvider, ProjectItem } from './views/ProjectsView';
import { AgentsViewProvider, AgentItem } from './views/AgentsView';
import { openDashboard } from './views/DashboardPanel';
import { openAgentDetail } from './views/AgentDetailPanel';
import { openAuthPanel } from './views/AuthPanel';
import { createStatusBar, updateStatusBar } from './statusBar';
import { setupAgent } from './commands/setupAgent';
import { createAgent } from './commands/createAgent';
import { rotateKey } from './commands/rotateKey';
import { cloneAgent } from './commands/cloneAgent';
import * as api from './services/api';

export function activate(context: vscode.ExtensionContext): void {
    console.log('NexySync extension activating...');

    // Init API client with secret storage
    initApiClient(context.secrets);

    // Create view providers
    const projectsView = new ProjectsViewProvider();
    const agentsView = new AgentsViewProvider(projectsView);

    // Register tree views
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('nexysync.projects', projectsView),
        vscode.window.registerTreeDataProvider('nexysync.agents', agentsView),
    );

    // Status bar
    const statusBar = createStatusBar();
    context.subscriptions.push(statusBar);

    // ── Auth commands ──
    const refreshAfterAuth = () => {
        vscode.commands.executeCommand('setContext', 'nexysync.loggedIn', auth.getState() === 'logged-in');
        projectsView.refresh();
        agentsView.refresh();
        updateStatusBar();
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('nexysync.login', async () => {
            openAuthPanel(context.extensionUri, refreshAfterAuth);
        }),
        vscode.commands.registerCommand('nexysync.register', async () => {
            openAuthPanel(context.extensionUri, refreshAfterAuth);
        }),
        vscode.commands.registerCommand('nexysync.logout', async () => {
            await auth.logout();
            vscode.commands.executeCommand('setContext', 'nexysync.loggedIn', false);
            vscode.commands.executeCommand('setContext', 'nexysync.projectSelected', false);
            projectsView.refresh();
            agentsView.refresh();
            updateStatusBar();
        }),
    );

    // ── Project commands ──
    context.subscriptions.push(
        vscode.commands.registerCommand('nexysync.createProject', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Project name',
                placeHolder: 'my-project',
                ignoreFocusOut: true,
            });
            if (!name) { return; }

            try {
                const result = await api.createProject(name);
                vscode.window.showInformationMessage(`✅ Project "${name}" created (slug: ${result.slug})`);
                projectsView.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
            }
        }),
        vscode.commands.registerCommand('nexysync.deleteProject', async (item: ProjectItem) => {
            const confirm = await vscode.window.showInputBox({
                prompt: `Type "${item.project.slug}" to confirm deletion`,
                placeHolder: item.project.slug,
                ignoreFocusOut: true,
            });
            if (confirm !== item.project.slug) {
                vscode.window.showInformationMessage('Deletion cancelled');
                return;
            }

            try {
                await api.deleteProject(item.project._id || item.project.id);
                vscode.window.showInformationMessage(`Project "${item.project.name}" deleted`);
                projectsView.refresh();
                agentsView.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
            }
        }),
        vscode.commands.registerCommand('nexysync.selectProject', (item: ProjectItem) => {
            projectsView.selectProject(item);
            vscode.commands.executeCommand('setContext', 'nexysync.projectSelected', true);
            agentsView.refresh();
            // Also open dashboard when clicking a Project
            const projectId = item.project._id || item.project.id;
            openDashboard(context.extensionUri, projectId, item.project.name);
        }),
        vscode.commands.registerCommand('nexysync.refreshProjects', () => {
            projectsView.refresh();
        }),
    );

    // ── Agent commands ──
    context.subscriptions.push(
        vscode.commands.registerCommand('nexysync.createAgent', async () => {
            const projectId = projectsView.getSelectedProjectId();
            await createAgent(projectId);
            agentsView.refresh();
        }),
        vscode.commands.registerCommand('nexysync.setupAgent', async (item?: AgentItem) => {
            await setupAgent(item);
            updateStatusBar();
        }),
        vscode.commands.registerCommand('nexysync.rotateKey', async (item: AgentItem) => {
            await rotateKey(item.projectId, item.agent._id || item.agent.id, item.agent.slug);
            updateStatusBar();
        }),
        vscode.commands.registerCommand('nexysync.cloneAgent', async (item: AgentItem) => {
            await cloneAgent(item.projectId, item.agent._id || item.agent.id, item.agent.slug);
        }),
        vscode.commands.registerCommand('nexysync.copyAgentKey', async (item: AgentItem) => {
            const rotate = await vscode.window.showWarningMessage(
                'To get a raw API key, a new one must be generated (the current key will be invalidated).',
                { modal: true },
                'Generate & Copy',
            );
            if (rotate === 'Generate & Copy') {
                try {
                    const result = await api.rotateAgentKey(item.projectId, item.agent._id || item.agent.id);
                    await vscode.env.clipboard.writeText(result.apiKey);
                    vscode.window.showInformationMessage('API key copied to clipboard');
                    updateStatusBar();
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to rotate key: ${(err as Error).message}`);
                }
            }
        }),
        vscode.commands.registerCommand('nexysync.deleteAgent', async (item: AgentItem) => {
            const confirm = await vscode.window.showInputBox({
                prompt: `Type "${item.agent.slug}" to confirm deletion`,
                placeHolder: item.agent.slug,
                ignoreFocusOut: true,
            });
            if (confirm !== item.agent.slug) {
                vscode.window.showInformationMessage('Deletion cancelled');
                return;
            }

            try {
                await api.deleteAgent(item.projectId, item.agent._id || item.agent.id);
                vscode.window.showInformationMessage(`Agent "${item.agent.slug}" deleted`);
                agentsView.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
            }
        }),
        vscode.commands.registerCommand('nexysync.refreshAgents', () => {
            agentsView.refresh();
        }),
        vscode.commands.registerCommand('nexysync.agentDetail', async (item: AgentItem) => {
            const project = projectsView.getSelectedProject();
            const projectName = project?.name || 'Unknown Project';
            openAgentDetail(item.agent, item.projectId, projectName, {
                onRotateKey: async (pid, aid, slug) => {
                    await rotateKey(pid, aid, slug);
                    updateStatusBar();
                },
                onCloneAgent: async (pid, aid, slug) => {
                    await cloneAgent(pid, aid, slug);
                },
                onSetupWorkspace: async (_apiKey) => {
                    await setupAgent();
                    updateStatusBar();
                },
                onEditAgent: async (_pid, _aid) => {
                    // Delegate to the editAgent command with the same item
                    vscode.commands.executeCommand('nexysync.editAgent', item);
                },
                onDeleteAgent: async (pid, aid, slug) => {
                    const confirm = await vscode.window.showInputBox({
                        prompt: `Type "${slug}" to confirm deletion`,
                        placeHolder: slug,
                        ignoreFocusOut: true,
                    });
                    if (confirm !== slug) {
                        vscode.window.showInformationMessage('Deletion cancelled');
                        return;
                    }
                    try {
                        await api.deleteAgent(pid, aid);
                        vscode.window.showInformationMessage(`Agent "${slug}" deleted`);
                        agentsView.refresh();
                    } catch (err) {
                        vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
                    }
                },
            });
        }),
        vscode.commands.registerCommand('nexysync.editAgent', async (item: AgentItem) => {
            const agentId = item.agent._id || item.agent.id;
            const currentName = item.agent.name || item.agent.slug;
            const currentRole = item.agent.role || '';

            const newName = await vscode.window.showInputBox({
                prompt: 'Agent name',
                value: currentName,
                ignoreFocusOut: true,
            });
            if (newName === undefined) { return; } // cancelled

            const newRole = await vscode.window.showInputBox({
                prompt: 'Agent role (optional)',
                value: currentRole,
                ignoreFocusOut: true,
            });
            if (newRole === undefined) { return; } // cancelled

            const updates: { name?: string; role?: string } = {};
            if (newName !== currentName) { updates.name = newName; }
            if (newRole !== currentRole) { updates.role = newRole; }

            if (Object.keys(updates).length === 0) {
                vscode.window.showInformationMessage('No changes made');
                return;
            }

            try {
                await api.updateAgent(item.projectId, agentId, updates);
                vscode.window.showInformationMessage(`Agent "${newName}" updated`);
                agentsView.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
            }
        }),
    );

    // ── Dashboard ──
    context.subscriptions.push(
        vscode.commands.registerCommand('nexysync.dashboard', async (item?: ProjectItem) => {
            const project = item?.project || projectsView.getSelectedProject();
            if (!project) {
                vscode.window.showInformationMessage('Select a Project first');
                return;
            }
            openDashboard(context.extensionUri, project._id || project.id, project.name);
        }),
    );

    // Initialize auth state
    auth.initialize().then(() => {
        const loggedIn = auth.getState() === 'logged-in';
        vscode.commands.executeCommand('setContext', 'nexysync.loggedIn', loggedIn);
        vscode.commands.executeCommand('setContext', 'nexysync.projectSelected', false);
        if (loggedIn) {
            projectsView.refresh();
        }
        updateStatusBar();
    });

    console.log('NexySync extension activated ⚡');
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
