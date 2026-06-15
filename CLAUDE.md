# Warden Desktop

Project notes for agents working in this repo. Keep this file as guardrails and pointers; do not duplicate the full docs here.

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
- If project structure changes, update [docs/README.md](docs/README.md) and [docs/architecture.1.md](docs/architecture.md).
- If setup, dev, or build commands change, update [docs/setup.md](docs/setup.md).
- If product scope changes, update [docs/project.md](docs/project.md).
- Prefer existing patterns over new abstractions.

## Do Not

- Do not reintroduce the Go CLI.
- Do not move the backend out of `backend/` without updating scripts, Tauri config/launcher behavior, and docs.
- Do not edit generated output by hand.
- Do not treat generated output as source of truth.

## Commands

- `pnpm dev:all`
- `pnpm build`
- `pnpm build:backend`
- `pnpm build:app`
- `pnpm lint` (Biome) / `pnpm typecheck` (tsc)
- `uv sync` в `backend/` для установки Python deps
- `uv run pytest` в `backend/`
- `uv run ruff check .` / `uv run ruff format .` в `backend/`

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

## Tech Debt (введено в этапе 1)

- В `biome.json` понижены до `warn` несколько правил (`useButtonType`, `noSvgWithoutTitle`,
  `noStaticElementInteractions`, `noArrayIndexKey`) — компоненты, которых это касается, чинятся
  на этапе 4 (разрезание `App.tsx` и сопутствующий рефакторинг JSX). После этапа 4 эти правила
  должны вернуться к `error`.
- В `backend/` остаётся ~150 предупреждений ruff (mutable-class-default, unused-import,
  ambiguous-variable-name и т.п.) — рефакторим вместе с реструктуризацией тестов на этапе 5.
