<div align="center">

<img src="docs/demo.gif" alt="Warden Desktop demo" width="100%" />

<br />

```
██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
██║ █╗ ██║███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
██║███╗██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝
```

**AI agent desktop shell with full computer control**

[![Release](https://img.shields.io/github/v/release/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1&label=latest)](https://github.com/elev1e1nSure/warden-desktop/releases/latest)
[![License](https://img.shields.io/github/license/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-6366f1?style=flat-square)](https://tauri.app)
[![Python](https://img.shields.io/badge/backend-Python-6366f1?style=flat-square)](https://python.org)

[**Download**](https://github.com/elev1e1nSure/warden-desktop/releases/latest) · [**Docs**](docs/README.md) · [**Report bug**](https://github.com/elev1e1nSure/warden-desktop/issues)

</div>

---

## What it does

Warden gives an AI agent hands. It reads and writes files, runs shell commands, takes screenshots, controls the browser, clicks the mouse, and manages windows — all through a chat interface.

Works with [OpenRouter](https://openrouter.ai) — bring any model: GPT, Claude, DeepSeek, Gemini.

---

## Capabilities

```
┌─────────────────────────────────────────────────────────────┐
│  Files       read · write · search · archives · patches    │
│  Shell       PowerShell · Bash · risk-based security        │
│  Browser     URLs · screenshots · clicks · forms · YouTube  │
│  Screen      OCR · image search · mouse · keyboard          │
│  System      processes · windows · notifications · clipboard│
│  Memory      long-term · retrieval · aggregation             │
│  Network     HTTP · web scraping                             │
│  Code        LSP · session todo-list                         │
└─────────────────────────────────────────────────────────────┘
```

### Modes

| Mode | Behavior |
|------|----------|
| **Ask** | Agent asks for confirmation before every action |
| **Auto** | Executes without confirmation; dangerous operations show a modal |

---

## Quick Start

### Download installer

Go to [Releases](https://github.com/elev1e1nSure/warden-desktop/releases/latest) and grab:

- `warden-desktop_x64-setup.exe` — NSIS installer
- `warden-desktop_x64_en-US.msi` — MSI package

### Build from source

```powershell
# Install dependencies
pnpm install

# Run in development mode
pnpm dev:all

# Build installer
pnpm build:app
```

> Requires: Node.js 22+, pnpm, Python 3.11+, Rust toolchain

---

## Project structure

```
warden-desktop/
├── backend/       # Python: agent runtime, tools, memory, skills
├── src/           # React UI
├── src-tauri/     # Tauri shell, desktop packaging
├── scripts/       # build & dev helpers
├── public/        # static assets
└── docs/          # documentation & architecture
```

Architecture, data flow, and source map → see [docs/README.md](docs/README.md).

---

## Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion |
| Desktop | Tauri 2 (Rust) |
| Backend | Python · aiohttp · uv |
| LLM | OpenRouter (OpenAI-compatible API) |
| Build | pnpm · PyInstaller · NSIS/MSI |

---

<div align="center">

Built solo · open source · [MIT License](LICENSE)

</div>
