// NexySync — Auth Panel (Branded WebviewPanel)
// Full-page login/register form with NexySync branding

import * as vscode from 'vscode';
import * as api from '../services/api';
import * as auth from '../auth/AuthProvider';

let _panel: vscode.WebviewPanel | undefined;

// Callbacks for when auth completes (so extension.ts can react)
let _onAuthComplete: (() => void) | undefined;

export function openAuthPanel(
    extensionUri: vscode.Uri,
    onComplete?: () => void,
): void {
    _onAuthComplete = onComplete;

    if (_panel) {
        _panel.reveal();
        return;
    }

    _panel = vscode.window.createWebviewPanel(
        'nexysync.auth',
        'NexySync — Sign In',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        },
    );

    _panel.onDidDispose(() => { _panel = undefined; });
    _panel.webview.html = getAuthHtml();

    // Handle messages from webview
    _panel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
            case 'login':
                await handleLogin(msg.email, msg.password);
                break;
            case 'register':
                await handleRegister(msg.name, msg.email, msg.password);
                break;
        }
    });
}

export function closeAuthPanel(): void {
    if (_panel) {
        _panel.dispose();
        _panel = undefined;
    }
}

async function handleLogin(email: string, password: string): Promise<void> {
    try {
        sendMessage({ type: 'loading', loading: true });
        const result = await api.login(email, password);
        api.setTokens(result.accessToken, result.refreshToken);
        auth.setState('logged-in', result.user);
        sendMessage({ type: 'success', message: `Welcome back, ${result.user.name || email}!` });
        // Auto-close after brief delay
        setTimeout(() => {
            closeAuthPanel();
            _onAuthComplete?.();
        }, 1200);
    } catch (err) {
        const message = err instanceof api.ApiError ? err.message : 'Network error — check your connection';
        sendMessage({ type: 'error', message });
    }
}

async function handleRegister(name: string, email: string, password: string): Promise<void> {
    try {
        sendMessage({ type: 'loading', loading: true });
        const result = await api.register(email, password, name, '2026.1', '2026.1');
        if (result.accessToken) {
            api.setTokens(result.accessToken, result.refreshToken);
            auth.setState('logged-in', result.user);
        }
        sendMessage({
            type: 'success',
            message: `Account created! Check ${email} for verification.`,
        });
        setTimeout(() => {
            closeAuthPanel();
            _onAuthComplete?.();
        }, 2000);
    } catch (err) {
        const message = err instanceof api.ApiError ? err.message : 'Network error — check your connection';
        sendMessage({ type: 'error', message });
    }
}

function sendMessage(msg: any): void {
    _panel?.webview.postMessage(msg);
}

// ── HTML Template ──

function getAuthHtml(): string {
    return `<!DOCTYPE html>
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
            background: var(--ns-void);
            color: var(--ns-frost);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .auth-container {
            width: 100%;
            max-width: 420px;
            padding: 48px 32px;
        }

        /* ── Brand Header ── */
        .brand {
            text-align: center;
            margin-bottom: 40px;
        }

        .brand-wordmark {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .brand-wordmark .nexy { color: var(--ns-frost); }
        .brand-wordmark .sync { color: var(--ns-cyan); }

        .brand-tagline {
            color: var(--ns-text-muted);
            font-size: 14px;
            margin-top: 8px;
            font-weight: 400;
        }

        /* ── Tab Toggle ── */
        .tabs {
            display: flex;
            background: var(--ns-surface-1);
            border-radius: 8px;
            padding: 4px;
            margin-bottom: 28px;
            border: 1px solid var(--ns-border);
        }

        .tab {
            flex: 1;
            text-align: center;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            color: var(--ns-text-muted);
            transition: all 0.2s ease;
            border: none;
            background: none;
            font-family: inherit;
        }

        .tab:hover { color: var(--ns-frost); }

        .tab.active {
            background: var(--ns-surface-2);
            color: var(--ns-cyan);
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        /* ── Form ── */
        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: var(--ns-text-secondary);
            margin-bottom: 6px;
        }

        .form-input {
            width: 100%;
            padding: 12px 14px;
            background: var(--ns-surface-1);
            border: 1px solid var(--ns-border);
            border-radius: 8px;
            color: var(--ns-frost);
            font-family: inherit;
            font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
            outline: none;
        }

        .form-input::placeholder { color: var(--ns-text-muted); }
        .form-input:focus {
            border-color: var(--ns-cyan);
            box-shadow: 0 0 0 3px var(--ns-cyan-glow);
        }

        .form-input.error {
            border-color: var(--ns-error);
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .form-error {
            font-size: 12px;
            color: var(--ns-error);
            margin-top: 4px;
            display: none;
        }

        .form-error.visible { display: block; }

        /* ── Checkbox ── */
        .checkbox-group {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 24px;
        }

        .checkbox-group input[type="checkbox"] {
            margin-top: 2px;
            accent-color: var(--ns-cyan);
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .checkbox-label {
            font-size: 13px;
            color: var(--ns-text-secondary);
            line-height: 1.4;
        }

        .checkbox-label a {
            color: var(--ns-cyan-dim);
            text-decoration: none;
        }

        .checkbox-label a:hover {
            color: var(--ns-cyan);
            text-decoration: underline;
        }

        /* ── Submit Button ── */
        .submit-btn {
            width: 100%;
            padding: 14px;
            background: var(--ns-cyan);
            color: var(--ns-void);
            border: none;
            border-radius: 8px;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        }

        .submit-btn:hover {
            background: #33EBFF;
            box-shadow: 0 4px 20px var(--ns-cyan-glow);
        }

        .submit-btn:active {
            transform: scale(0.98);
        }

        .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .submit-btn.loading {
            color: transparent;
        }

        .submit-btn.loading::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            margin: -10px 0 0 -10px;
            border: 2px solid var(--ns-void);
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* ── Messages ── */
        .message {
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 20px;
            display: none;
            animation: fadeIn 0.2s ease;
        }

        .message.visible { display: block; }

        .message.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #FCA5A5;
        }

        .message.success {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #6EE7B7;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ── Footer ── */
        .footer {
            text-align: center;
            margin-top: 32px;
            font-size: 12px;
            color: var(--ns-text-muted);
        }

        .footer a {
            color: var(--ns-text-secondary);
            text-decoration: none;
        }

        .footer a:hover {
            color: var(--ns-cyan);
        }

        /* ── Transitions ── */
        .form-section {
            transition: opacity 0.15s ease;
        }

        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="auth-container">

        <!-- Brand -->
        <div class="brand">
            <div class="brand-wordmark">
                <span class="nexy">Nexy</span><span class="sync">Sync</span>
            </div>
            <div class="brand-tagline">The nervous system for AI agents.</div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
            <button class="tab active" id="tab-login" onclick="switchTab('login')">Sign In</button>
            <button class="tab" id="tab-register" onclick="switchTab('register')">Create Account</button>
        </div>

        <!-- Message area -->
        <div class="message" id="message"></div>

        <!-- Login Form -->
        <div id="form-login" class="form-section">
            <div class="form-group">
                <label class="form-label" for="login-email">Email</label>
                <input class="form-input" type="email" id="login-email"
                       placeholder="you@example.com" autocomplete="email" />
                <div class="form-error" id="login-email-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="login-password">Password</label>
                <input class="form-input" type="password" id="login-password"
                       placeholder="••••••••" autocomplete="current-password" />
                <div class="form-error" id="login-password-error"></div>
            </div>
            <button class="submit-btn" id="login-btn" onclick="submitLogin()">Sign In</button>
        </div>

        <!-- Register Form -->
        <div id="form-register" class="form-section hidden">
            <div class="form-group">
                <label class="form-label" for="reg-name">Name</label>
                <input class="form-input" type="text" id="reg-name"
                       placeholder="Your name" autocomplete="name" />
                <div class="form-error" id="reg-name-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="reg-email">Email</label>
                <input class="form-input" type="email" id="reg-email"
                       placeholder="you@example.com" autocomplete="email" />
                <div class="form-error" id="reg-email-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="reg-password">Password</label>
                <input class="form-input" type="password" id="reg-password"
                       placeholder="Min 8 characters" autocomplete="new-password" />
                <div class="form-error" id="reg-password-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="reg-confirm">Confirm Password</label>
                <input class="form-input" type="password" id="reg-confirm"
                       placeholder="••••••••" autocomplete="new-password" />
                <div class="form-error" id="reg-confirm-error"></div>
            </div>
            <div class="checkbox-group">
                <input type="checkbox" id="reg-tos" />
                <label class="checkbox-label" for="reg-tos">
                    I agree to the <a href="https://nexysync.com/terms">Terms of Service</a>
                    and <a href="https://nexysync.com/privacy">Privacy Policy</a>
                </label>
            </div>
            <button class="submit-btn" id="register-btn" onclick="submitRegister()">Create Account</button>
        </div>

        <!-- Footer -->
        <div class="footer">
            <a href="https://nexysync.com">nexysync.com</a>
            &nbsp;·&nbsp;
            <a href="https://nexysync.com/terms">Terms</a>
            &nbsp;·&nbsp;
            <a href="https://nexysync.com/privacy">Privacy</a>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // ── Tab switching ──
        function switchTab(tab) {
            const loginForm = document.getElementById('form-login');
            const registerForm = document.getElementById('form-register');
            const loginTab = document.getElementById('tab-login');
            const registerTab = document.getElementById('tab-register');
            const message = document.getElementById('message');

            // Clear messages
            message.className = 'message';
            clearErrors();

            if (tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                loginTab.classList.add('active');
                registerTab.classList.remove('active');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
                loginTab.classList.remove('active');
                registerTab.classList.add('active');
            }
        }

        // ── Validation ──
        function showError(id, msg) {
            const el = document.getElementById(id);
            const input = document.getElementById(id.replace('-error', ''));
            if (el) { el.textContent = msg; el.classList.add('visible'); }
            if (input) { input.classList.add('error'); }
        }

        function clearErrors() {
            document.querySelectorAll('.form-error').forEach(e => {
                e.classList.remove('visible');
                e.textContent = '';
            });
            document.querySelectorAll('.form-input').forEach(e => {
                e.classList.remove('error');
            });
        }

        function validateEmail(email) {
            return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
        }

        // ── Login ──
        function submitLogin() {
            clearErrors();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            let valid = true;

            if (!email) { showError('login-email-error', 'Email is required'); valid = false; }
            else if (!validateEmail(email)) { showError('login-email-error', 'Invalid email format'); valid = false; }

            if (!password) { showError('login-password-error', 'Password is required'); valid = false; }

            if (!valid) return;

            setLoading('login-btn', true);
            vscode.postMessage({ type: 'login', email, password });
        }

        // ── Register ──
        function submitRegister() {
            clearErrors();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const tos = document.getElementById('reg-tos').checked;
            let valid = true;

            if (!name) { showError('reg-name-error', 'Name is required'); valid = false; }
            if (!email) { showError('reg-email-error', 'Email is required'); valid = false; }
            else if (!validateEmail(email)) { showError('reg-email-error', 'Invalid email format'); valid = false; }
            if (!password) { showError('reg-password-error', 'Password is required'); valid = false; }
            else if (password.length < 8) { showError('reg-password-error', 'Password must be at least 8 characters'); valid = false; }
            if (password !== confirm) { showError('reg-confirm-error', 'Passwords do not match'); valid = false; }
            if (!tos) { showError('reg-confirm-error', 'You must agree to the Terms of Service'); valid = false; }

            if (!valid) return;

            setLoading('register-btn', true);
            vscode.postMessage({ type: 'register', name, email, password });
        }

        // ── Loading state ──
        function setLoading(btnId, loading) {
            const btn = document.getElementById(btnId);
            if (loading) {
                btn.classList.add('loading');
                btn.disabled = true;
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        }

        // ── Enter key submission ──
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const loginForm = document.getElementById('form-login');
                if (!loginForm.classList.contains('hidden')) {
                    submitLogin();
                } else {
                    submitRegister();
                }
            }
        });

        // ── Messages from extension ──
        window.addEventListener('message', (event) => {
            const msg = event.data;
            const messageEl = document.getElementById('message');

            switch (msg.type) {
                case 'loading':
                    if (!msg.loading) {
                        setLoading('login-btn', false);
                        setLoading('register-btn', false);
                    }
                    break;
                case 'error':
                    setLoading('login-btn', false);
                    setLoading('register-btn', false);
                    messageEl.textContent = msg.message;
                    messageEl.className = 'message error visible';
                    break;
                case 'success':
                    setLoading('login-btn', false);
                    setLoading('register-btn', false);
                    messageEl.textContent = msg.message;
                    messageEl.className = 'message success visible';
                    break;
            }
        });
    </script>
</body>
</html>`;
}
