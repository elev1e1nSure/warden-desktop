# Warden Desktop

Project notes for agents working in this repo. Keep this file as guardrails and pointers; do not duplicate the full docs here.

## 1. Language & Commits

- Commit messages and code comments must be in English only (overrides the global Russian-commit preference for this repo).
- Use conventional commits with a scope: `type(scope): description`, no trailing period.
- After completing any logically complete action or iteration, the agent must explicitly propose making a Git commit to the user.

## 2. Architecture & Boundaries

- `src/` owns UI state, rendering, and user interactions.
- `src/api/` owns frontend wrappers for the backend protocol. All requests must go through these wrappers with proper NDJSON stream event handling.
- `backend/agent/` owns the agent runtime, LLM calls, tools, memory, skills, safety, routes, and streamed events.
- `src-tauri/` owns the desktop shell, bundled backend startup, and packaging.
- The UI does not execute tools directly; it sends requests to the backend and renders streamed events.
- Keep changes scoped to the layer that owns the behavior.
- If backend routes, stream events, launch flow, or packaging change, update the related code and docs together.
- If project structure changes, update [docs/README.md](docs/README.md) and [docs/architecture.md](docs/architecture.md).
- If setup, dev, or build commands change, update [docs/setup.md](docs/setup.md).
- If product scope changes, update [docs/project.md](docs/project.md).

### Sources Of Truth
- Always refer to and rely on the documentation in [docs/](docs/) if you need to understand or look up anything about the project setup, architecture, or flow.
- Project overview: [docs/project.md](docs/project.md)
- Architecture and runtime flow: [docs/architecture.md](docs/architecture.md)
- Setup and build details: [docs/setup.md](docs/setup.md)
- Docs map: [docs/README.md](docs/README.md)

## 3. Style & Linting Guidelines

### Frontend
- **Formatting & Linting**: Managed by Biome. Ensure your edits conform to Biome lint rules and formatting standards.
- **TypeScript**: Strict type system rules are active (`strict: true`, `noUncheckedIndexedAccess: true`). Avoid type assertions (`as`) and `any` where possible.
- **React 19 State**: Minimize global state. Prefer local component state (`useState`, `useMemo`) and custom hooks inside `src/hooks/` without introducing unnecessary state abstractions.
- **Styling**: Tailwind CSS v4 is in use. Always use custom theme variables defined in `@theme` inside [src/index.css](src/index.css) (e.g., `var(--color-bg)`, `text-text-primary`) rather than arbitrary/ad-hoc hex colors to preserve visual harmony.

### Backend
- **Formatting & Linting**: Managed by Ruff. Ensure imports are sorted and unused imports are cleaned up where applicable.

### Tool Descriptions & Running Labels
- When adding a new tool (`backend/agent/tools/`) or a new action to an existing tool, you **must** add a matching `case` to `toolDescription(b)` and `toolRunningLabel(b)` in [src/lib/toolDescription.ts](src/lib/toolDescription.ts) that returns a human-readable sentence. Never leave a new tool falling through to the generic fallback.

### Do Not
- Do not reintroduce the Go CLI.
- Do not move the backend out of `backend/` without updating scripts, Tauri config/launcher behavior, and docs.
- Do not edit generated output by hand.
- Do not treat generated output as source of truth.
- Prefer existing patterns over new abstractions.

## 4. Development Commands (Recommended)

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

### Raw Commands
- `pnpm dev:all` - run all components together
- `pnpm build:app` - build Tauri application
- `pnpm build:backend` - build backend exe
- `pnpm lint` (Biome) / `pnpm typecheck` (tsc)
- `uv sync` in `backend/` to install Python dependencies
- `uv run pytest` in `backend/`
- `uv run ruff check .` / `uv run ruff format .` in `backend/`

### Testing Requirements
- **Backend Tests**: Create tests for new features and tools under `backend/agent/test_*.py`. Total backend code coverage must remain at or above 79% (enforced by `--cov-fail-under=79` in pytest).
- **Pre-commit Checks**: Run `just test` (or `just check`) locally to verify that all lints and tests pass before committing or pushing.

## 5. Generated Output

The following folders/files are generated and should not be tracked or hand-edited:
- `dist/`
- `backend/.venv/`
- `backend/htmlcov/`
- `backend/.pytest_cache/`
- `backend/.coverage`
- `backend/coverage.json`
- `backend/dist/`
- `backend/build/`
- `src-tauri/target/`