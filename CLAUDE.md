# Warden Desktop

Project notes for agents working in this repo. Keep this file as guardrails and pointers; do not duplicate the full docs here.

## Language

- Commit messages and code comments must be in English only.

## Sources Of Truth

- Project overview: [docs/project.md](docs/project.md)
- Architecture and runtime flow: [docs/architecture.md](docs/architecture.md)
- Setup and build details: [docs/setup.md](docs/setup.md)
- Docs map: [docs/README.md](docs/README.md)

## Boundaries

- `src/` owns UI state, rendering, and user interactions.
- `src/api/` owns frontend wrappers for the backend protocol.
- `backend/agent/` owns the agent runtime, LLM calls, tools, memory, skills, safety, routes, and streamed events.
- `src-tauri/` owns the desktop shell, bundled backend startup, and packaging.
- The UI does not execute tools directly; it sends requests to the backend and renders streamed events.

## Guardrails

- Keep changes scoped to the layer that owns the behavior.
- If backend routes, stream events, launch flow, or packaging change, update the related code and docs together.
- If project structure changes, update [docs/README.md](docs/README.md) and [docs/architecture.md](docs/architecture.md).
- If setup, dev, or build commands change, update [docs/setup.md](docs/setup.md).
- If product scope changes, update [docs/project.md](docs/project.md).
- Prefer existing patterns over new abstractions.
- When adding a new tool (`backend/agent/tools/`) or a new action to an existing tool, add a matching `case` to `toolDescription()` in `src/components/Timeline.tsx` that returns a human-readable sentence (e.g. `Clicked at (X, Y)`, `Read config.json`). Never leave a new tool falling through to the generic fallback.

## Commits

- Write commit messages in English (overrides the global Russian-commit preference for this repo).
- Use conventional commits with a scope: `type(scope): description`, no trailing period.

## Do Not

- Do not reintroduce the Go CLI.
- Do not move the backend out of `backend/` without updating scripts, Tauri config/launcher behavior, and docs.
- Do not edit generated output by hand.
- Do not treat generated output as source of truth.

## Commands

Use `just` to run development tasks:
- `just install` - install all dependencies (frontend and backend)
- `just dev` - run full dev environment (frontend, backend, Tauri)
- `just check` - run typecheck and all lints (frontend and backend)
- `just lint` - run lints (Biome and Ruff)
- `just format` - auto-format code (Biome and Ruff)
- `just test` - run all tests (frontend and backend)
- `just build-app` - build complete desktop app installer
- `just build-backend` - compile backend executable via PyInstaller
- `just clean` - clean build caches and compiled assets

Alternative/raw commands:
- `pnpm dev:all` - run all components together
- `pnpm build:app` - build Tauri application
- `pnpm build:backend` - build backend exe
- `pnpm lint` (Biome) / `pnpm typecheck` (tsc)
- `uv sync` in `backend/` to install Python dependencies
- `uv run pytest` in `backend/`
- `uv run ruff check .` / `uv run ruff format .` in `backend/`

Full setup details live in [docs/setup.md](docs/setup.md).

## Generated Output

- `dist/`
- `backend/.venv/`
- `backend/htmlcov/`
- `backend/.pytest_cache/`
- `backend/.coverage`
- `backend/coverage.json`
- `backend/dist/`
- `backend/build/`
- `src-tauri/target/`