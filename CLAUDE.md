# Warden Desktop

Project notes for agents working in this repo. Keep this file as guardrails and pointers; do not duplicate the full docs here.

## 1. Language & Commits

- Commit messages and code comments must be in English only (overrides the global Russian-commit preference for this repo).
- Use conventional commits with a scope: `type(scope): description`, no trailing period.
- After completing any logically complete action or iteration, commit immediately without asking.

## 2. Architecture & Boundaries

- `src/` owns UI state, rendering, and user interactions.
- `src/api/` owns frontend wrappers for the backend protocol. All requests go through these wrappers with proper NDJSON stream event handling.
- `src-tauri/` owns the desktop shell and packaging.
- Keep changes scoped to the layer that owns the behavior.
- If project structure changes, update [docs/README.md](docs/README.md) and [docs/architecture.md](docs/architecture.md).
- If setup, dev, or build commands change, update [docs/setup.md](docs/setup.md).
- If product scope changes, update [docs/project.md](docs/project.md).

### Sources Of Truth
- Always refer to and rely on the documentation in [docs/](docs/) if you need to understand or look up anything about the project setup, architecture, or flow.
- Project overview: [docs/project.md](docs/project.md)
- Architecture and flow: [docs/architecture.md](docs/architecture.md)
- Setup and build details: [docs/setup.md](docs/setup.md)
- Docs map: [docs/README.md](docs/README.md)

## 3. Style & Linting Guidelines

### Frontend
- **Formatting & Linting**: Managed by Biome. Ensure your edits conform to Biome lint rules and formatting standards.
- **TypeScript**: Strict type system rules are active (`strict: true`, `noUncheckedIndexedAccess: true`). Avoid type assertions (`as`) and `any` where possible.
- **React 19 State**: Minimize global state. Prefer local component state (`useState`, `useMemo`) and custom hooks inside `src/hooks/` without introducing unnecessary state abstractions.
- **Styling**: Tailwind CSS v4 is in use. Always use custom theme variables defined in `@theme` inside [src/index.css](src/index.css) (e.g., `var(--color-bg)`, `text-text-primary`) rather than arbitrary/ad-hoc hex colors to preserve visual harmony.

### Do Not
- Do not reintroduce the Go CLI.
- Do not edit generated output by hand.
- Do not treat generated output as source of truth.
- Prefer existing patterns over new abstractions.

## 4. Development Commands (Recommended)

Use `just` to run development tasks:
- `just install` - install all dependencies
- `just dev` - run dev environment (frontend and Tauri dev window)
- `just check` - run typecheck and all lints
- `just lint` - run lints (Biome)
- `just format` - auto-format code (Biome)
- `just test` - run all tests
- `just build-app` - build complete desktop app installer
- `just clean` - clean build caches and compiled assets

### Raw Commands
- `pnpm dev:all` - run Tauri dev environment
- `pnpm build:app` - build Tauri application
- `pnpm lint` (Biome) / `pnpm typecheck` (tsc)

### Testing Requirements
- **Pre-commit Checks**: Run `just test` (or `just check`) locally to verify that all lints and tests pass before committing or pushing.

## 5. Generated Output

The following folders/files are generated and should not be tracked or hand-edited:
- `dist/`
- `src-tauri/target/`