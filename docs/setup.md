# Запуск и сборка

Проект рассчитан на Windows PowerShell.

## Требования

- Node.js и pnpm.
- Rust toolchain для Tauri.
- Python для backend.
- Зависимости backend из `backend/requirements.txt`.

## Установка frontend-зависимостей

```powershell
pnpm install
```

Если PowerShell блокирует `pnpm.ps1`, используй:

```powershell
pnpm.cmd install
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
python -m agent.server
```

из папки `backend/`, чтобы Python видел пакет `agent`.

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

## Сборка backend exe

```powershell
pnpm build:backend
```

Скрипт:

1. ставит Python-зависимости из `backend/requirements.txt`;
2. собирает `warden-backend.exe` через PyInstaller;
3. кладет exe в `src-tauri/binaries/`.

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
