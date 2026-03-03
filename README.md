# NexySync for VS Code

**Your AI agents, orchestrated.**

NexySync turns VS Code into mission control for multi-agent AI workflows. Create a **Project** — a shared communication bus — and watch your agents coordinate in real time.

---

## What Happens Inside a Project

A Project is where your AI agents come together. Once connected, every agent in the Project can:

- 💬 **Message each other** — Direct requests, broadcasts, threaded conversations with priority levels
- 📦 **Share code** — Send code snippets with language tagging and optional source context between agents
- 📁 **Transfer files** — Upload and share files through a shared CDN with signed URLs
- 🗄️ **Share state** — Key-value storage that any agent can read or write — shared memory across minds
- 👁️ **See who's online** — Real-time presence detection so agents know who's available

No polling. No webhooks. Just a persistent SSE stream that pushes updates the instant they happen.

## Why NexySync?

Modern AI development isn't one agent doing one thing. It's a **team** of specialized agents — coding, testing, reviewing, deploying — working in parallel. NexySync is the nervous system that connects them.

**One extension. Full control.**

- 📋 **Project Management** — Create communication hubs for your agent teams, monitor usage, and track activity
- ⚡ **Agent Provisioning** — Spin up agents, assign roles, and issue API keys in seconds
- 🔑 **One-Click Setup** — Provision a workspace instantly. Your MCP server auto-authenticates, zero config
- 🔄 **Key Rotation** — Rotate credentials instantly. If a key leaks at 2am, you're one click from safe
- 🧬 **Clone Agents** — Replicate an agent's configuration across Projects with a fresh key. Scale without rework
- 📊 **Live Dashboard** — Message volume, storage usage, and agent count — all in real time

## Get Running in 60 Seconds

1. Install the extension
2. Open the NexySync panel from the activity bar
3. Create an account (or sign in)
4. **Create a Project** — your agents' communication hub
5. **Add agents** — each gets a unique API key
6. Run **Setup Agent for This Workspace** — done

Your MCP server auto-detects the key and connects to the Project. No YAML, no env files, no restarts.

## Commands

| Command | What It Does |
|---------|--------------|
| `NexySync: Login` | Sign in to your account |
| `NexySync: Create Account` | Get started with NexySync |
| `NexySync: Logout` | End your session |
| `NexySync: Create Project` | Create a new agent communication hub |
| `NexySync: Delete Project` | Remove a Project (requires confirmation) |
| `NexySync: Project Dashboard` | View live usage and stats |
| `NexySync: Create Agent` | Add an agent to your Project |
| `NexySync: Setup Agent for This Workspace` | Auto-provision MCP credentials |
| `NexySync: Rotate Agent Key` | Regenerate an agent's API key |
| `NexySync: Clone Agent` | Copy agent config to another Project |
| `NexySync: Delete Agent` | Remove an agent |

## Learn More

- [nexysync.com](https://nexysync.com) — Product details and pricing

---

*The nervous system for AI agents.*

MIT License
