<p align="center">
  <img src="docs/demo.gif" alt="Warden Desktop demo" width="100%" />
</p>

<br />

<pre align="center">
██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
██║ █╗ ██║███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
██║███╗██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝
</pre>

<p align="center">
  <strong>AI agent desktop shell with full computer control</strong>
</p>

<p align="center">
  <a href="https://github.com/elev1e1nSure/warden-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1&label=latest" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1" alt="License"></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/built%20with-Tauri%202-6366f1?style=flat-square" alt="Built with Tauri"></a>
  <a href="https://python.org"><img src="https://img.shields.io/badge/backend-Python-6366f1?style=flat-square" alt="Python"></a>
</p>

<p align="center">
  <a href="https://github.com/elev1e1nSure/warden-desktop/releases/latest"><strong>Download</strong></a>
  ·
  <a href="docs/README.md"><strong>Docs</strong></a>
  ·
  <a href="https://github.com/elev1e1nSure/warden-desktop/issues"><strong>Report bug</strong></a>
</p>

---

## What it does

Warden gives an AI agent hands. It reads and writes files, runs shell commands, takes screenshots, controls the browser, clicks the mouse, and manages windows — all through a chat interface.

Works with [OpenRouter](https://openrouter.ai) — bring any model: GPT, Claude, DeepSeek, Gemini.

---

## Capabilities

```
Files       read · write · search · archives · patches
Shell       PowerShell · Bash · risk-based security
Browser     URLs · screenshots · clicks · forms · YouTube
Screen      OCR · image search · mouse · keyboard
System      processes · windows · notifications · clipboard
Memory      long-term · retrieval · aggregation
Network     HTTP · web scraping
Code        LSP · session todo-list
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
pnpm install
pnpm dev:all
pnpm build:app
```

Requires: Node.js 22+, pnpm, Python 3.11+, Rust toolchain

---

## Project structure

```
warden-desktop/
├── backend/       Python agent runtime, tools, memory, skills
├── src/           React UI
├── src-tauri/     Tauri shell, desktop packaging
├── scripts/       build & dev helpers
├── public/        static assets
└── docs/          documentation & architecture
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

<p align="center">
  Built solo · open source · <a href="LICENSE">MIT License</a>
</p>
