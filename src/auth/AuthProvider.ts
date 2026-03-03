// NexySync — Auth Provider
// Manages login state, JWT lifecycle, emits auth state changes
// Login/register UI handled by AuthPanel WebviewPanel

import * as vscode from 'vscode';
import * as api from '../services/api';

export type AuthState = 'logged-in' | 'logged-out';

const _onDidChangeAuthState = new vscode.EventEmitter<AuthState>();
export const onDidChangeAuthState = _onDidChangeAuthState.event;

let _currentUser: any;
let _state: AuthState = 'logged-out';

export function getState(): AuthState {
    return _state;
}

export function getCurrentUser(): any {
    return _currentUser;
}

export function setState(s: AuthState, user?: any): void {
    _state = s;
    _currentUser = user;
    _onDidChangeAuthState.fire(s);
}

/**
 * Initialize — load tokens from SecretStorage, check if still valid.
 */
export async function initialize(): Promise<void> {
    const loaded = await api.loadTokens();
    if (loaded) {
        setState('logged-in');
    }
}

/**
 * Login — opens the branded AuthPanel.
 * The actual API call is handled by AuthPanel.ts via postMessage.
 * This function is kept for backward compatibility.
 */
export async function login(): Promise<boolean> {
    // AuthPanel is opened by extension.ts command handler
    return false;
}

/**
 * Register — opens the branded AuthPanel on the register tab.
 * The actual API call is handled by AuthPanel.ts via postMessage.
 * This function is kept for backward compatibility.
 */
export async function register(): Promise<boolean> {
    // AuthPanel is opened by extension.ts command handler
    return false;
}

/**
 * Logout — clear all tokens and state.
 */
export async function logout(): Promise<void> {
    await api.clearTokens();
    setState('logged-out');
    vscode.window.showInformationMessage('Logged out of NexySync');
}
