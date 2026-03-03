// NexySync — Agents TreeView
// Shows agents in the selected project

import * as vscode from 'vscode';
import * as api from '../services/api';
import type { ProjectsViewProvider } from './ProjectsView';

export class AgentItem extends vscode.TreeItem {
    constructor(
        public readonly agent: any,
        public readonly projectId: string,
    ) {
        super(agent.name || agent.slug, vscode.TreeItemCollapsibleState.None);
        this.id = agent._id || agent.id;
        this.description = agent.slug;
        this.tooltip = `${agent.name || agent.slug}\nRole: ${agent.role || 'none'}\nSlug: ${agent.slug}`;
        this.contextValue = 'agent';
        this.command = {
            command: 'nexysync.agentDetail',
            title: 'View Agent Details',
            arguments: [this],
        };

        // Online/offline indicator
        const lastSeen = agent.lastSeen ? new Date(agent.lastSeen) : null;
        const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 5 * 60 * 1000;
        this.iconPath = new vscode.ThemeIcon(
            'account',
            isOnline
                ? new vscode.ThemeColor('charts.green')
                : new vscode.ThemeColor('disabledForeground'),
        );
    }
}

export class AgentsViewProvider implements vscode.TreeDataProvider<AgentItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AgentItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private _projectsView: ProjectsViewProvider) { }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: AgentItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<AgentItem[]> {
        const projectId = this._projectsView.getSelectedProjectId();
        if (!projectId) {
            return [];
        }

        try {
            const result = await api.getAgents(projectId);
            const agents = result.agents || [];
            return agents.map((a: any) => new AgentItem(a, projectId));
        } catch (err) {
            if (err instanceof api.ApiError && err.status === 401) {
                return [];
            }
            vscode.window.showErrorMessage(`Failed to load agents: ${(err as Error).message}`);
            return [];
        }
    }
}
