# Warden Desktop Docs

This is a short project map. There are no contributor rules here; these documents exist to help you quickly understand what the application does, how its components are assembled, and how to run it.

## What to Read

- [project.md](project.md) — what the project does and where its boundaries are.
- [architecture.md](architecture.md) — how the desktop UI, Tauri wrapper, and Go backend are connected.
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
  .warden/         # skills storage
  agent/           # Go backend: agent runtime, tools, memory
  cmd/             # Entry points (warden-backend binary)
  internal/        # Internal packages (client, security)
  check/           # Development check scripts
  src/             # React UI
  src-tauri/       # Tauri shell and desktop compilation
  scripts/         # dev/build scripts
  public/          # static frontend assets (favicon, icon)
  docs/            # documentation
  justfile         # project build tasks
  AGENTS.md        # agent instructions
  CLAUDE.md        # Claude desktop agent config
  biome.json       # frontend linter/formatter
  package.json     # frontend dependencies and scripts
  go.mod           # Go module definition
</pre>