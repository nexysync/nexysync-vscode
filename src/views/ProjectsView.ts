// NexySync — Projects TreeView
// Shows user's projects in the sidebar

import * as vscode from 'vscode';
import * as api from '../services/api';
import * as auth from '../auth/AuthProvider';

export class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly project: any,
    ) {
        super(project.name, vscode.TreeItemCollapsibleState.None);
        this.id = project._id || project.id;
        this.description = project.slug;
        this.tooltip = `${project.name} (${project.slug})`;
        this.contextValue = 'project';
        this.iconPath = new vscode.ThemeIcon('folder');
        this.command = {
            command: 'nexysync.selectProject',
            title: 'Select Project',
            arguments: [this],
        };
    }
}

export class ProjectsViewProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _projects: any[] = [];
    private _selectedProjectId: string | undefined;

    constructor() {
        auth.onDidChangeAuthState(() => this.refresh());
    }

    getSelectedProject(): any {
        return this._projects.find(p => (p._id || p.id) === this._selectedProjectId);
    }

    getSelectedProjectId(): string | undefined {
        return this._selectedProjectId;
    }

    selectProject(item: ProjectItem): void {
        this._selectedProjectId = item.id as string;
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        // Highlight selected
        if (element.id === this._selectedProjectId) {
            element.iconPath = new vscode.ThemeIcon('folder-opened');
        }
        return element;
    }

    async getChildren(): Promise<ProjectItem[]> {
        if (auth.getState() !== 'logged-in') {
            return [];
        }

        try {
            const result = await api.getProjects();
            this._projects = result.projects || [];
            return this._projects.map(p => new ProjectItem(p));
        } catch (err) {
            if (err instanceof api.ApiError && err.status === 401) {
                return [];
            }
            vscode.window.showErrorMessage(`Failed to load projects: ${(err as Error).message}`);
            return [];
        }
    }
}
