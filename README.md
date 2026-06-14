# Warden Desktop

Desktop UI for the Warden agent.

The app is a Tauri + React shell around a local Python backend. The backend exposes HTTP and NDJSON streaming endpoints on `http://localhost:8765`; the frontend renders chats, model selection, confirmations, questions, skills, and memory controls.

## Structure

```text
backend/      Python backend: agent runtime, tools, memory, skills
src/          React desktop UI
src-tauri/    Tauri shell and desktop packaging
scripts/      development and build helpers
docs/         project documentation
```

Start with [docs/README.md](docs/README.md).

## Development

```powershell
pnpm install
pnpm dev:all
```

## Build

```powershell
pnpm build:app
```
