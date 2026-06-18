# Warden Desktop Docs

This is a short project map. There are no contributor rules here; these documents exist to help you quickly understand what the application does, how its components are assembled, and how to run it.

## What to Read

- [project.md](project.md) — what the project does and where its boundaries are.
- [architecture.md](architecture.md) — how the desktop UI, Tauri wrapper, and backend are connected.
- [setup.md](setup.md) — how to set up the project locally and build the application.

## Documentation Structure

```text
docs/
  README.md        # entry point
  project.md       # about the project
  architecture.md  # how it works
  setup.md         # how to run and build
```

## Quick Project Map

```text
warden-desktop/
  backend/         # Python backend: agent runtime, tools, memory, skills
  src/             # React UI for the desktop application
  src-tauri/       # Tauri shell, window, desktop application compilation
  scripts/         # dev/build scripts for the backend
  public/          # static frontend assets
  dist/            # frontend build output
```
