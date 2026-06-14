# О проекте

Warden Desktop — desktop-оболочка для Warden agent. Приложение дает графический интерфейс для общения с агентом, выбора модели, работы с чатами, подтверждения действий и просмотра доступных skills.

В текущем виде проект объединяет несколько частей:

- desktop UI на React;
- Tauri-приложение, которое упаковывает UI в нативное desktop-окно;
- Python backend в `backend/`, который отвечает за chat API, streaming, tools, confirmations, memory и skills.

## Основные сценарии

- Подключить модель через UI.
- Выбрать модель из списка backend.
- Создать или выбрать чат.
- Отправить сообщение агенту.
- Получать streaming-ответы и tool events.
- Подтверждать опасные действия через модальное окно.
- Отвечать на уточняющие вопросы агента.
- Смотреть и включать skills.
- Управлять режимом Ask / Auto.

## Что входит в этот проект

- Визуальная desktop-оболочка для Warden.
- Интеграция с backend на `http://localhost:8765`.
- Сборка frontend через Vite.
- Desktop packaging через Tauri.
- Скрипты для запуска и сборки Python backend.

## Backend

Папка `backend/` содержит agent runtime:

- `backend/agent/` — Python backend;
- `backend/requirements.txt` — Python-зависимости;
- `backend/run_backend.py` — entrypoint для PyInstaller;
- `backend/.warden/skills/` — project skills.

Go CLI из проекта удален: desktop UI теперь единственный frontend к Python backend.
