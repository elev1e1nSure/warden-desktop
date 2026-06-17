# Launch and Build

The project is designed to run on Windows PowerShell.

## Requirements

- Node.js and pnpm.
- Rust toolchain for Tauri.
- Python 3.11+.
- [uv](https://docs.astral.sh/uv/) for Python dependency and virtual environment management.
- Optionally: [just](https://github.com/casey/just) for convenient command running.

## Quick Start with Just (Recommended)

If you have `just` installed, you can use the following commands from the root directory:

- **Install all dependencies** (both frontend and backend):
  ```powershell
  just install
  ```
- **Start the development environment** (Vite frontend, Python backend, and Tauri dev window):
  ```powershell
  just dev
  ```
- **Run all code checks** (TypeScript typecheck and lints):
  ```powershell
  just check
  ```
- **Run all tests** (both frontend and backend):
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

You can also install all dependencies manually:
```powershell
pnpm install
# then in backend directory
cd backend
uv sync
```

Or step-by-step:

### Install Frontend Dependencies

```powershell
pnpm install
```

If PowerShell blocks execution of `pnpm.ps1`, use:

```powershell
pnpm.cmd install
```

### Install Backend Dependencies

```powershell
uv sync
```

Run this command inside the `backend/` directory. It creates a `.venv` folder and installs runtime and development dependencies specified in `pyproject.toml` and `uv.lock`.

Optional dependency extras:

```powershell
uv sync --extra tools    # pyautogui, playwright, html2text
uv sync --extra build    # pyinstaller (for building the executable)
```

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

This starts the Vite dev server. It does not start the Python backend.

### Run Backend Only

```powershell
just dev-backend    # or: pnpm dev:backend
```

This runs `uv run python -m agent.server` from the `backend/` directory. `uv` will automatically activate the `.venv` virtual environment.

### Run Desktop App with Backend (Manual)

```powershell
pnpm dev:all
```

This script concurrently launches:
- Python backend;
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
just check            # Check TypeScript types and run all lints (frontend + backend)
just lint             # Run lints only (Biome + Ruff)
just format           # Auto-format code (Biome + Ruff)
just test             # Run all tests
```

Manual check commands:
```powershell
pnpm lint           # Biome lint (frontend)
pnpm format         # Biome format --write
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome: lint, format, and import sort

uv run ruff check backend       # Python lint (run in backend/)
uv run ruff format backend      # Python format (run in backend/)
uv run pytest                   # Backend tests (run in backend/)
```

## Building Backend Executable

```powershell
just build-backend    # or: pnpm build:backend
```

This script:
1. Installs backend dependencies including optional tools and build extras (`uv sync --extra tools --extra build`).
2. Builds the `warden-backend.exe` executable using `uv run pyinstaller`.
3. Places the compiled executable inside the `src-tauri/binaries/` directory.

## Building Desktop Application

```powershell
just build-app        # or: pnpm build:app
```

This command first builds the backend executable, then starts the Tauri build using the custom config file `src-tauri/tauri.bundle.conf.json`.

## Common Verification Points

- Backend health check: `http://localhost:8765/health`.
- REST client frontend wrappers: `src/api/client.ts`.
- Streaming client frontend: `src/api/stream.ts`.
- Backend server entry point: `backend/agent/server.py`.
- Tauri configuration: `src-tauri/tauri.conf.json`.
