# Launch and Build

The project is designed to run on Windows PowerShell.

## Requirements

- Node.js 22+ and pnpm.
- Go 1.25+.
- Rust toolchain for Tauri.
- [playwright](https://playwright.dev) for browser automation.
- Optionally: [just](https://github.com/casey/just) for convenient command running.

## Quick Start with Just (Recommended)

If you have `just` installed, you can use the following commands from the root directory:

- **Install all dependencies** (frontend only; Go modules are fetched on build):
  ```powershell
  just install
  ```
- **Start the development environment** (Vite frontend, Go backend, and Tauri dev window):
  ```powershell
  just dev
  ```
- **Run all code checks** (TypeScript typecheck and lints):
  ```powershell
  just check
  ```
- **Run all tests** (both frontend and Go backend):
  ```powershell
  just test
  ```
- **Build the desktop application**:
  ```powershell
  just build-app
  ```
- **Clean temporary build files and caches**:
  ```powershell
  just clean
  ```

To view the list of all available commands, run `just` without arguments.

## Manual Dependency Installation

### Install Frontend Dependencies

```powershell
pnpm install
```

If PowerShell blocks execution of `pnpm.ps1`, use:

```powershell
pnpm.cmd install
```

### Install Playwright Browsers

```powershell
npx playwright install chromium
```

Go dependencies are managed via `go.mod` and are fetched automatically during build — no manual step required.

## Running for Development

To launch the complete environment, run:
```powershell
just dev
```

Or run the components individually:

### Run Frontend Only

```powershell
just dev-frontend   # or: pnpm dev
```

This starts the Vite dev server. It does not start the Go backend.

### Run Backend Only

```powershell
just dev-backend    # or: pnpm dev:backend
```

This runs `go run ./cmd/warden-backend` from the project root.

### Run Desktop App with Backend (Manual)

```powershell
pnpm dev:all
```

This script concurrently launches:
- Go backend;
- Tauri desktop shell;
- Vite frontend dev server.

## Building Frontend

```powershell
just build-frontend   # or: pnpm build
```

This runs the TypeScript check and builds the Vite frontend. The output is placed in the `dist/` directory.

## Lints and Checks

Recommended commands:
```powershell
just check            # Check TypeScript types and run lints
just lint             # Run lints (Biome)
just format           # Auto-format code (Biome)
just test             # Run all tests
```

Manual check commands:
```powershell
pnpm lint           # Biome lint (frontend)
pnpm format         # Biome format --write
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome: lint, format, and import sort

go test ./agent/... ./internal/... ./cmd/...  # Go backend tests
```

## Running Tests

```powershell
just test            # All tests (frontend + Go backend)
just test-frontend   # Frontend only (vitest)
just test-backend    # Go backend only
```

To run Go tests manually:
```powershell
go test ./agent/... ./internal/... ./cmd/...
go test -v ./agent/...           # Verbose output
go test -run TestChat ./agent/... # Run specific test
```

## Building Backend Executable

```powershell
just build-backend    # or: pnpm build:backend
```

This compiles the Go backend into a single executable using:
```powershell
go build -ldflags="-H windowsgui" -o src-tauri/binaries/warden-backend.exe ./cmd/warden-backend
```

The `-H windowsgui` flag suppresses the console window for the release build.

## Building Desktop Application

```powershell
just build-app        # or: pnpm build:app
```

This command first builds the Go backend executable, then starts the Tauri build using the custom config file `src-tauri/tauri.bundle.conf.json`.

## Common Verification Points

- Backend health check: `http://localhost:8765/health`.
- REST client frontend wrappers: `src/api/client.ts`.
- Streaming client frontend: `src/api/stream.ts`.
- Backend entry point: `cmd/warden-backend/main.go`.
- Tauri configuration: `src-tauri/tauri.conf.json`.