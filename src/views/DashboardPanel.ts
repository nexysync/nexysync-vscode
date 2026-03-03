// NexySync — Dashboard WebviewPanel
// Shows usage stats, storage, and recent activity

import * as vscode from 'vscode';
import * as api from '../services/api';

let _panel: vscode.WebviewPanel | undefined;

export function openDashboard(extensionUri: vscode.Uri, projectId: string, projectName: string): void {
    if (_panel) {
        _panel.reveal();
    } else {
        _panel = vscode.window.createWebviewPanel(
            'nexysync.dashboard',
            `NexySync: ${projectName}`,
            vscode.ViewColumn.One,
            { enableScripts: true },
        );
        _panel.onDidDispose(() => { _panel = undefined; });

        // Handle button clicks
        _panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'createAgent':
                    vscode.commands.executeCommand('nexysync.createAgent');
                    break;
            }
        });
    }

    _panel.title = `NexySync: ${projectName}`;
    loadDashboardContent(_panel, projectId, projectName);
}

async function loadDashboardContent(
    panel: vscode.WebviewPanel,
    projectId: string,
    projectName: string,
): Promise<void> {
    let usageHtml = '<p>Loading...</p>';

    // Get logged-in user info from JWT
    const user = api.getLoggedInUser();
    const userDisplayHtml = user
        ? `<span class="user-name">${escapeHtml(user.name)}</span>
           <span class="user-plan">${escapeHtml(user.plan)}</span>`
        : '<span class="header-badge">Logged In</span>';

    try {
        const usage = await api.getUsage(projectId);
        usageHtml = `
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Messages Today</div>
                <div class="stat-value">${usage.msgsToday ?? 0}</div>
                <div class="stat-sub">/ ${usage.msgsPerDayLimit ?? 1500}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ref Storage</div>
                <div class="stat-value">${formatMb(usage.refStorageBytes)}</div>
                <div class="stat-sub">/ ${usage.storageMbLimit ?? 50} MB</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${percent(usage.refStorageBytes, usage.storageMbLimit)}%"></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">File Storage</div>
                <div class="stat-value">${formatMb(usage.fileStorageBytes)}</div>
                <div class="stat-sub">/ ${usage.storageMbLimit ?? 50} MB</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${percent(usage.fileStorageBytes, usage.storageMbLimit)}%"></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Agents</div>
                <div class="stat-value">${usage.agentCount ?? 0}</div>
                <div class="stat-sub">/ ${usage.agentLimit ?? 10}</div>
            </div>
        </div>`;
    } catch (err) {
        usageHtml = `<p class="error">Failed to load usage: ${(err as Error).message}</p>`;
    }

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

        .project-name {
            font-size: 20px;
            font-weight: 600;
            color: var(--ns-frost);
        }

        .header-badge {
            font-size: 11px;
            font-weight: 500;
            color: var(--ns-success);
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.25);
            padding: 4px 10px;
            border-radius: 20px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .user-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--ns-frost);
        }

        .user-plan {
            font-size: 11px;
            font-weight: 500;
            color: var(--ns-cyan);
            background: var(--ns-cyan-glow);
            border: 1px solid rgba(0, 229, 255, 0.2);
            padding: 3px 8px;
            border-radius: 12px;
            text-transform: capitalize;
        }

        /* ── Stat Grid ── */
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--ns-surface-1);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--ns-border);
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--ns-cyan), var(--ns-cyan-dim));
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .stat-card:hover {
            border-color: var(--ns-cyan-dim);
            box-shadow: 0 4px 24px rgba(0, 229, 255, 0.06);
        }

        .stat-card:hover::before {
            opacity: 1;
        }

        .stat-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--ns-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--ns-cyan);
            line-height: 1;
        }

        .stat-sub {
            font-size: 13px;
            color: var(--ns-text-muted);
            margin-top: 4px;
        }

        /* ── Progress Bar ── */
        .progress-bar {
            margin-top: 12px;
            height: 4px;
            background: var(--ns-surface-2);
            border-radius: 2px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--ns-cyan-dim), var(--ns-cyan));
            border-radius: 2px;
            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-fill.warn {
            background: linear-gradient(90deg, var(--ns-warning), #FBBF24);
        }

        .progress-fill.danger {
            background: linear-gradient(90deg, var(--ns-error), #F87171);
        }

        /* ── Error ── */
        .error {
            color: var(--ns-error);
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.2);
            padding: 16px;
            border-radius: 8px;
            font-size: 14px;
        }

        /* ── Actions ── */
        .actions-section {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
        }

        .action-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 24px;
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
            <span class="project-name">${escapeHtml(projectName)}</span>
        </div>
        <span class="header-right">
            ${userDisplayHtml}
        </span>
    </div>

    ${usageHtml}

    <div class="actions-section">
        <button class="action-btn primary" onclick="vscode.postMessage({ command: 'createAgent' })">
            <span class="action-icon">🤖</span> Create Agent
        </button>
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

function formatMb(bytes: number | undefined): string {
    if (!bytes) { return '0 KB'; }
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
}

function percent(bytes: number | undefined, limitMb: number | undefined): number {
    if (!bytes || !limitMb) { return 0; }
    return Math.min(100, (bytes / (limitMb * 1024 * 1024)) * 100);
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
