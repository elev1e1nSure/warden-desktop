# Запуск и сборка

Проект рассчитан на Windows PowerShell.

## Требования

- Node.js и pnpm.
- Rust toolchain для Tauri.
- Python 3.11+.
- [uv](https://docs.astral.sh/uv/) для управления Python-зависимостями и виртуальным окружением.

## Установка frontend-зависимостей

```powershell
pnpm install
```

Если PowerShell блокирует `pnpm.ps1`, используй:

```powershell
pnpm.cmd install
```

## Установка backend-зависимостей

```powershell
uv sync
```

из папки `backend/`. Команда создаёт `.venv` и ставит runtime + dev зависимости из `pyproject.toml`/`uv.lock`.

Опциональные extras:

```powershell
uv sync --extra tools    # pyautogui, playwright, html2text
uv sync --extra build    # pyinstaller (для сборки exe)
```

## Запуск только frontend

```powershell
pnpm dev
```

Это запускает Vite dev server. Сам по себе он не поднимает backend.

## Запуск backend для разработки

```powershell
pnpm dev:backend
```

Скрипт запускает:

```text
uv run python -m agent.server
```

из папки `backend/`. uv автоматически активирует `.venv`.

## Запуск desktop-приложения вместе с backend

```powershell
pnpm dev:all
```

Этот сценарий запускает одновременно:

- Python backend;
- Tauri desktop app;
- Vite frontend dev server.

## Сборка frontend

```powershell
pnpm build
```

Команда выполняет TypeScript check и Vite build. Результат попадает в `dist/`.

## Линт и проверки

```powershell
pnpm lint           # Biome lint (frontend)
pnpm format         # Biome format --write
pnpm typecheck      # tsc --noEmit
pnpm check          # Biome: lint + format + import-sort

uv run ruff check backend       # Python lint
uv run ruff format backend      # Python format
uv run pytest                   # Backend тесты (из backend/)
```

## Сборка backend exe

```powershell
pnpm build:backend
```

Скрипт:

1. вызывает `uv sync --extra tools --extra build`;
2. собирает `warden-backend.exe` через `uv run pyinstaller`;
3. кладёт exe в `src-tauri/binaries/`.

## Сборка desktop-приложения

```powershell
pnpm build:app
```

Команда сначала собирает backend, потом запускает Tauri build с конфигом:

```text
src-tauri/tauri.bundle.conf.json
```

## Частые места для проверки

- Backend health: `http://localhost:8765/health`.
- REST client frontend: `src/api/client.ts`.
- Streaming client frontend: `src/api/stream.ts`.
- Backend server: `backend/agent/server.py`.
- Tauri config: `src-tauri/tauri.conf.json`.
