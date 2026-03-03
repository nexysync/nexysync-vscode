// NexySync — Agent Detail WebviewPanel
// Shows agent info, status, and actions

import * as vscode from 'vscode';

let _panel: vscode.WebviewPanel | undefined;

interface AgentDetailCallbacks {
    onRotateKey: (projectId: string, agentId: string, slug: string) => void;
    onCloneAgent: (projectId: string, agentId: string, slug: string) => void;
    onSetupWorkspace: (apiKey: string) => void;
    onEditAgent: (projectId: string, agentId: string) => void;
    onDeleteAgent: (projectId: string, agentId: string, slug: string) => void;
}

export function openAgentDetail(
    agent: any,
    projectId: string,
    projectName: string,
    callbacks: AgentDetailCallbacks,
): void {
    if (_panel) {
        _panel.reveal();
    } else {
        _panel = vscode.window.createWebviewPanel(
            'nexysync.agentDetail',
            `Agent: ${agent.name || agent.slug}`,
            vscode.ViewColumn.One,
            { enableScripts: true },
        );
        _panel.onDidDispose(() => { _panel = undefined; });
    }

    _panel.title = `Agent: ${agent.name || agent.slug}`;

    // Handle button clicks from webview
    _panel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.command) {
            case 'rotateKey':
                callbacks.onRotateKey(projectId, agent._id || agent.id, agent.slug);
                break;
            case 'cloneAgent':
                callbacks.onCloneAgent(projectId, agent._id || agent.id, agent.slug);
                break;
            case 'setupWorkspace':
                callbacks.onSetupWorkspace('');
                break;
            case 'editAgent':
                callbacks.onEditAgent(projectId, agent._id || agent.id);
                break;
            case 'deleteAgent':
                callbacks.onDeleteAgent(projectId, agent._id || agent.id, agent.slug);
                break;
        }
    });

    renderPanel(_panel, agent, projectName);
}

function renderPanel(panel: vscode.WebviewPanel, agent: any, projectName: string): void {
    const lastSeen = agent.lastSeen ? new Date(agent.lastSeen) : null;
    const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 5 * 60 * 1000;
    const statusText = isOnline ? 'Online' : 'Offline';
    const statusClass = isOnline ? 'online' : 'offline';
    const lastSeenText = lastSeen ? formatRelativeTime(lastSeen) : 'Never';
    const createdAt = agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    }) : 'Unknown';

    const capabilities = (agent.capabilities || []) as string[];
    const capsHtml = capabilities.length > 0
        ? capabilities.map((c: string) => `<span class="capability-tag">${escapeHtml(c)}</span>`).join('')
        : '<span class="text-muted">No capabilities set</span>';

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');

        :root {
            --ns-void: #0A0E1A;
            --ns-cyan: #00E5FF;
            --ns-frost: #EAEEF6;
            --ns-surface-1: #111827;
            --ns-surface-2: #1E293B;
            --ns-border: #334155;
            --ns-text-secondary: #94A3B8;
            --ns-text-muted: #64748B;
            --ns-cyan-dim: #0891B2;
            --ns-cyan-glow: rgba(0, 229, 255, 0.15);
            --ns-success: #10B981;
            --ns-error: #EF4444;
            --ns-warning: #F59E0B;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Outfit', system-ui, -apple-system, sans-serif;
            color: var(--ns-frost);
            background: var(--ns-void);
            padding: 32px;
        }

        .text-muted { color: var(--ns-text-muted); font-style: italic; }

        /* ── Header ── */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--ns-border);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .brand-wordmark {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.3px;
        }

        .brand-wordmark .nexy { color: var(--ns-frost); }
        .brand-wordmark .sync { color: var(--ns-cyan); }

        .header-sep {
            color: var(--ns-border);
            font-weight: 300;
            font-size: 20px;
        }

        .agent-name {
            font-size: 20px;
            font-weight: 600;
            color: var(--ns-frost);
        }

        .status-badge {
            font-size: 11px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 20px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .status-badge.online {
            color: var(--ns-success);
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .status-badge.offline {
            color: var(--ns-text-muted);
            background: rgba(100, 116, 139, 0.12);
            border: 1px solid rgba(100, 116, 139, 0.25);
        }

        /* ── Info Card ── */
        .info-section {
            background: var(--ns-surface-1);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--ns-border);
            margin-bottom: 20px;
        }

        .info-section h2 {
            font-size: 14px;
            font-weight: 600;
            color: var(--ns-cyan);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 12px 16px;
            align-items: baseline;
        }

        .info-label {
            font-size: 13px;
            font-weight: 500;
            color: var(--ns-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .info-value {
            font-size: 14px;
            color: var(--ns-frost);
            word-break: break-all;
        }

        .info-value.role {
            color: var(--ns-text-secondary);
            font-style: italic;
        }

        /* ── Capabilities ── */
        .capabilities {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .capability-tag {
            font-size: 11px;
            font-weight: 500;
            color: var(--ns-cyan);
            background: var(--ns-cyan-glow);
            border: 1px solid rgba(0, 229, 255, 0.2);
            padding: 3px 10px;
            border-radius: 12px;
            letter-spacing: 0.3px;
        }

        /* ── Actions ── */
        .actions-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .action-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Outfit', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--ns-border);
            background: var(--ns-surface-2);
            color: var(--ns-frost);
        }

        .action-btn:hover {
            border-color: var(--ns-cyan-dim);
            box-shadow: 0 4px 16px rgba(0, 229, 255, 0.08);
        }

        .action-btn.primary {
            background: linear-gradient(135deg, var(--ns-cyan-dim), #06b6d4);
            border-color: var(--ns-cyan);
            color: #fff;
            font-weight: 600;
        }

        .action-btn.primary:hover {
            box-shadow: 0 4px 20px rgba(0, 229, 255, 0.25);
        }

        .action-btn.danger {
            border-color: rgba(239, 68, 68, 0.3);
            color: var(--ns-error);
        }

        .action-btn.danger:hover {
            background: rgba(239, 68, 68, 0.08);
            border-color: var(--ns-error);
        }

        .action-icon {
            font-size: 16px;
        }

        /* ── Footer ── */
        .footer {
            text-align: center;
            font-size: 12px;
            color: var(--ns-text-muted);
            margin-top: 24px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <span class="brand-wordmark">
                <span class="nexy">Nexy</span><span class="sync">Sync</span>
            </span>
            <span class="header-sep">/</span>
            <span class="agent-name">${escapeHtml(agent.name || agent.slug)}</span>
        </div>
        <span class="status-badge ${statusClass}">● ${statusText}</span>
    </div>

    <div class="info-section">
        <h2>Agent Details</h2>
        <div class="info-grid">
            <span class="info-label">Slug</span>
            <span class="info-value">${escapeHtml(agent.slug)}</span>

            <span class="info-label">Project</span>
            <span class="info-value">${escapeHtml(projectName)}</span>

            <span class="info-label">Role</span>
            <span class="info-value role">${escapeHtml(agent.role || 'No role assigned')}</span>

            <span class="info-label">Last Seen</span>
            <span class="info-value">${escapeHtml(lastSeenText)}</span>

            <span class="info-label">Created</span>
            <span class="info-value">${escapeHtml(createdAt)}</span>
        </div>
    </div>

    <div class="info-section">
        <h2>Capabilities</h2>
        <div class="capabilities">
            ${capsHtml}
        </div>
    </div>

    <div class="info-section">
        <h2>Actions</h2>
        <div class="actions-grid">
            <button class="action-btn primary" onclick="vscode.postMessage({ command: 'rotateKey' })">
                <span class="action-icon">🔑</span> Rotate API Key
            </button>
            <button class="action-btn" onclick="vscode.postMessage({ command: 'cloneAgent' })">
                <span class="action-icon">🧬</span> Clone to Project
            </button>
            <button class="action-btn" onclick="vscode.postMessage({ command: 'editAgent' })">
                <span class="action-icon">✏️</span> Edit Agent
            </button>
            <button class="action-btn" onclick="vscode.postMessage({ command: 'setupWorkspace' })">
                <span class="action-icon">⚡</span> Setup Workspace
            </button>
            <button class="action-btn danger" onclick="vscode.postMessage({ command: 'deleteAgent' })">
                <span class="action-icon">🗑</span> Delete Agent
            </button>
        </div>
    </div>

    <div class="footer">
        nexysync.com
    </div>

    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
}

function formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) { return 'Just now'; }
    if (mins < 60) { return `${mins}m ago`; }
    const hours = Math.floor(mins / 60);
    if (hours < 24) { return `${hours}h ago`; }
    const days = Math.floor(hours / 24);
    if (days < 7) { return `${days}d ago`; }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
