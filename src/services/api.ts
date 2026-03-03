// NexySync — API Client Service
// HTTP client for all NexySync API calls with JWT auto-refresh

import * as vscode from 'vscode';

let _accessToken: string | undefined;
let _refreshToken: string | undefined;
let _secretStorage: vscode.SecretStorage;

export function initApiClient(secretStorage: vscode.SecretStorage): void {
    _secretStorage = secretStorage;
}

const API_URL = 'https://api.nexysync.com/v1';

function getApiUrl(): string {
    return API_URL;
}

export function setTokens(access: string, refresh: string): void {
    _accessToken = access;
    _refreshToken = refresh;
    _secretStorage.store('nexysync.accessToken', access);
    _secretStorage.store('nexysync.refreshToken', refresh);
}

export async function loadTokens(): Promise<boolean> {
    _accessToken = await _secretStorage.get('nexysync.accessToken');
    _refreshToken = await _secretStorage.get('nexysync.refreshToken');
    return !!_accessToken;
}

export async function clearTokens(): Promise<void> {
    _accessToken = undefined;
    _refreshToken = undefined;
    await _secretStorage.delete('nexysync.accessToken');
    await _secretStorage.delete('nexysync.refreshToken');
}

export function isLoggedIn(): boolean {
    return !!_accessToken;
}

/**
 * Decode JWT access token to get user info (no API call needed).
 */
export function getLoggedInUser(): { name: string; email: string; plan: string } | undefined {
    if (!_accessToken) { return undefined; }
    try {
        const parts = _accessToken.split('.');
        if (parts.length !== 3) { return undefined; }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return { name: payload.name, email: payload.email, plan: payload.plan };
    } catch {
        return undefined;
    }
}

// ── Core HTTP ──

async function apiCall<T = any>(
    path: string,
    options: {
        method?: string;
        body?: unknown;
        auth?: 'human' | 'agent' | 'none';
        agentKey?: string;
    } = {},
): Promise<T> {
    const { method = 'GET', body, auth = 'human', agentKey } = options;
    const url = `${getApiUrl()}${path}`;

    const headers: Record<string, string> = {};

    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth === 'human' && _accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
    } else if (auth === 'agent' && agentKey) {
        headers['Authorization'] = `Bearer ${agentKey}`;
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    // Auto-refresh on 401
    if (res.status === 401 && auth === 'human' && _refreshToken) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${_accessToken}`;
            const retry = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!retry.ok) {
                const errBody = await retry.json().catch(() => ({ error: retry.statusText })) as any;
                throw new ApiError(retry.status, errBody.error || retry.statusText, errBody.code);
            }
            return retry.json() as Promise<T>;
        } else {
            await clearTokens();
            throw new ApiError(401, 'Session expired. Please login again.', 'SESSION_EXPIRED');
        }
    }

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText })) as any;
        throw new ApiError(res.status, errBody.error || res.statusText, errBody.code);
    }

    return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
    try {
        const url = `${getApiUrl()}/auth/refresh`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: _refreshToken }),
        });
        if (!res.ok) { return false; }
        const data = await res.json() as { accessToken: string; refreshToken: string };
        setTokens(data.accessToken, data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// ── Auth ──

export async function register(email: string, password: string, name: string, tosVersion: string, privacyVersion: string) {
    return apiCall('/auth/register', {
        method: 'POST',
        body: {
            email,
            password,
            name,
            tos_accepted: true,
            tos_version: tosVersion,
            privacy_accepted: true,
            privacy_version: privacyVersion,
            marketing_opt_in: false,
        },
        auth: 'none',
    });
}

export async function login(email: string, password: string) {
    return apiCall<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: 'none',
    });
}

// ── Projects ──

export async function getProjects() {
    return apiCall<{ projects: any[] }>('/projects');
}

export async function createProject(name: string) {
    return apiCall('/projects', { method: 'POST', body: { name } });
}

export async function deleteProject(id: string) {
    return apiCall(`/projects/${id}?confirm=true`, { method: 'DELETE' });
}

export async function getUsage(projectId: string) {
    return apiCall(`/projects/${projectId}/usage`);
}

export async function updateProject(id: string, updates: { name?: string; default_ttl_hours?: number }) {
    return apiCall(`/projects/${id}`, { method: 'PATCH', body: updates });
}

// ── Agents ──

export async function getAgents(projectId: string) {
    return apiCall<{ agents: any[] }>(`/projects/${projectId}/agents`);
}

export async function createAgent(projectId: string, slug: string, name: string, role?: string) {
    return apiCall(`/projects/${projectId}/agents`, {
        method: 'POST',
        body: { slug, name, role },
    });
}

export async function rotateAgentKey(projectId: string, agentId: string) {
    return apiCall(`/projects/${projectId}/agents/${agentId}/rotate-key`, { method: 'POST' });
}

export async function cloneAgent(projectId: string, agentId: string, targetProjectId: string) {
    return apiCall(`/projects/${projectId}/agents/${agentId}/clone`, {
        method: 'POST',
        body: { target_project_id: targetProjectId },
    });
}

export async function deleteAgent(projectId: string, agentId: string) {
    return apiCall(`/projects/${projectId}/agents/${agentId}`, { method: 'DELETE' });
}

export async function updateAgent(projectId: string, agentId: string, updates: { name?: string; role?: string }) {
    return apiCall(`/projects/${projectId}/agents/${agentId}`, { method: 'PATCH', body: updates });
}


// ── Experts — hidden, future feature ──
// Expert API functions have been removed from the client.
// Server-side routes remain intact for future reactivation.
