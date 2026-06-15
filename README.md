<div align="center">

<img src="docs/demo.gif" alt="Warden Desktop demo" width="100%" />

<br />

```
██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗
██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║
██║ █╗ ██║███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║
██║███╗██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║
╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝
```

**Desktop-оболочка для ИИ-агента с полным контролем над компьютером**

[![Release](https://img.shields.io/github/v/release/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1&label=latest)](https://github.com/elev1e1nSure/warden-desktop/releases/latest)
[![License](https://img.shields.io/github/license/elev1e1nSure/warden-desktop?style=flat-square&color=6366f1)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-6366f1?style=flat-square)](https://tauri.app)
[![Python](https://img.shields.io/badge/backend-Python-6366f1?style=flat-square)](https://python.org)

[**Скачать**](https://github.com/elev1e1nSure/warden-desktop/releases/latest) · [**Документация**](docs/README.md) · [**Сообщить о баге**](https://github.com/elev1e1nSure/warden-desktop/issues)

</div>

---

## Что это

Warden даёт ИИ-агенту руки. Он читает и пишет файлы, запускает команды, делает скриншоты, управляет браузером, кликает мышкой — всё через обычный чат. Работает через [OpenRouter](https://openrouter.ai) — подключай любую модель: GPT, Claude, DeepSeek, Gemini.

---

## Возможности

```
┌─────────────────────────────────────────────────────────────┐
│  Файлы      чтение · запись · поиск · архивы · патчи       │
│  Shell      PowerShell · Bash · политика по уровню риска   │
│  Браузер    URL · скриншоты · клики · формы · YouTube       │
│  Экран      OCR · поиск изображений · мышь · клавиатура     │
│  Система    процессы · окна · уведомления · буфер обмена    │
│  Память     долговременная · извлечение · агрегация         │
│  Сеть       HTTP · веб-парсинг                              │
│  Код        LSP · todo-лист сессии                          │
└─────────────────────────────────────────────────────────────┘
```

### Режимы работы

| Режим | Поведение |
|-------|-----------|
| **Ask** | Агент спрашивает подтверждение перед каждым действием |
| **Auto** | Выполняет без подтверждения, опасные операции — с модальным окном |

---

## Быстрый старт

### Скачать готовый инсталлер

Перейди в [Releases](https://github.com/elev1e1nSure/warden-desktop/releases/latest) и скачай:

- `warden-desktop_x64-setup.exe` — NSIS инсталлер
- `warden-desktop_x64_en-US.msi` — MSI пакет

### Собрать из исходников

```powershell
# Установить зависимости
pnpm install

# Запустить в режиме разработки
pnpm dev:all

# Собрать инсталлер
pnpm build:app
```

> Требуется: Node.js 22+, pnpm, Python 3.11+, Rust toolchain

---

## Структура проекта

```
warden-desktop/
├── backend/       # Python: agent runtime, tools, memory, skills
├── src/           # React UI
├── src-tauri/     # Tauri shell, desktop packaging
├── scripts/       # build и dev helpers
├── public/        # статика
└── docs/          # документация и архитектура
```

Подробная архитектура, поток сообщений и карта исходников — в [docs/README.md](docs/README.md).

---

## Стек

| Слой | Технологии |
|------|-----------|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion |
| Desktop | Tauri 2 (Rust) |
| Backend | Python · aiohttp · uv |
| LLM | OpenRouter (OpenAI-совместимый API) |
| Сборка | pnpm · PyInstaller · NSIS/MSI |

---

<div align="center">

сделано в одиночку · open source · [MIT License](LICENSE)

</div>