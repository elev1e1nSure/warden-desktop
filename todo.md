# Warden Desktop — План работ

Поэтапный рефакторинг проекта. Каждый этап — отдельная ветка/PR, тесты прогоняются между шагами.

## Прогресс

| Этап | Тема                                | Статус   | Оценка   |
| ---- | ----------------------------------- | -------- | -------- |
| 1    | Гигиена и инструменты               | Готов    | день-два |
| 2    | Зависимости и чистка                | Ожидает  | полдня   |
| 3    | CI и тесты-страховка                | Ожидает  | день-два |
| 4    | Рефакторинг `App.tsx`               | Ожидает  | 2–3 дня  |
| 5    | Шлифовка и масштабируемость         | Ожидает  | день-два |

## Принципы

- На каждом этапе — отдельный PR, маленькие коммиты внутри.
- Между шагами прогоняем `pnpm typecheck && pnpm check && uv run ruff check . && uv run pytest`.
- Если задача требует переписывать чужой код массово — выносим в техдолг, отмечаем правило в конфиге как warn/ignore с TODO, чтобы не блокировать CI.
- Любые расхождения с этим планом — фиксируем в этом же файле или в `CLAUDE.md`.

## Quick reference (после этапа 1)

```powershell
# фронт
pnpm install
pnpm typecheck
pnpm check                # biome lint + format + organize imports
pnpm format               # biome format --write
pnpm build                # tsc + vite build

# бэк (из backend/)
uv sync                   # runtime + dev
uv sync --extra tools     # + pyautogui/playwright/html2text
uv sync --extra build     # + pyinstaller
uv run ruff check .
uv run ruff format .
uv run pytest             # 527 passed / 12 skipped

# всё вместе
pnpm dev:all              # backend + tauri + vite
pnpm build:app            # backend exe + tauri bundle
```

---

## Этап 1 — Гигиена и инструменты [ГОТОВО]

**Зачем.** Без линтеров, форматтеров и lockfile рефакторить страшно — невозможно отличить регрессию от стилистического шума.

**Готово когда.** `pnpm typecheck`, `pnpm check`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest` выходят с кодом 0.

**Принятые решения.**

- Фронт-линтер: **Biome** (один тул, нулевая конфигурация).
- Python-деп-менеджер: **uv + pyproject.toml** (lockfile, dependency groups, extras).

**Задачи.**

- [x] Установить Biome 2.x, создать `biome.json` (space/2, lineWidth 100, double quotes, organize imports, исключить `backend/`, `dist/`, `src-tauri/target`, `*.css`).
- [x] Добавить в `package.json` скрипты `lint`, `format`, `format:check`, `check`, `check:fix`, `typecheck`.
- [x] Поднять `tsconfig.json`: `target` и `lib` → ES2022, включить `noUncheckedIndexedAccess`.
- [x] Починить 13 ошибок типов от строгого индексного доступа в `App.tsx`, `InputBar.tsx`, `QuestionModal.tsx`, `SkillsView.tsx`, `Timeline.tsx`.
- [x] Установить `@types/node`, прописать `types: ["node"]` в `tsconfig.node.json`, выкинуть `@ts-expect-error` из `vite.config.ts:5`.
- [x] Применить `biome format --write .` (34 файла переформатированы).
- [x] Применить `biome check --write --unsafe .` (organize imports, optional chain, templates, useExhaustiveDependencies). Починить `Tooltip.tsx` руками после optional-chain автофикса.
- [x] Поправить `noAssignInExpressions` в `src/api/stream.ts` (вынес `nl = buffer.indexOf("\n")` из условия while).
- [x] Создать `backend/pyproject.toml`: runtime deps, `[project.optional-dependencies]` `tools`/`build`, `[dependency-groups]` `dev`, `[tool.uv] package = false`. Перенести конфиги pytest и coverage из `pytest.ini`.
- [x] Настроить ruff: `select = [E, F, I, B, UP, SIM, RUF]`, `target-version = py311`, `line-length = 100`.
- [x] `uv sync` — сгенерировать `uv.lock`, поднять `.venv` (39 пакетов).
- [x] Перенести **Pillow** из optional в runtime deps (top-level импорт в `chat.py:9` — без неё backend не стартовал).
- [x] Применить `uv run ruff check . --fix` (328 авто-фиксов) и `uv run ruff format .` (62 файла).
- [x] Удалить `backend/requirements.txt` и `backend/pytest.ini`.
- [x] Перевести `scripts/dev-backend.mjs` на `uv run python -m agent.server`.
- [x] Перевести `scripts/build-backend.ps1` на `uv sync --extra tools --extra build` + `uv run pyinstaller`.
- [x] Обновить `.gitignore` (`.venv/`, `backend/.venv/`, `backend/dist/`, `backend/build/`).
- [x] Обновить `docs/setup.md` (требования, установка через uv, команды линтинга).
- [x] Обновить `CLAUDE.md` (команды, generated output, раздел Tech Debt).
- [x] Финальные прогоны: typecheck=0, biome=0 errors (33 warnings — техдолг), ruff=0, pytest=527 passed.

**Техдолг, появившийся на этапе.**

- В `biome.json` понижены до `warn`: `useButtonType` (22), `noSvgWithoutTitle` (4), `noStaticElementInteractions` (2), `noArrayIndexKey` (4). Возврат к `error` — в рамках этапа 4.
- В `backend/pyproject.toml` в `[tool.ruff.lint] ignore` добавлены: `RUF012`, `RUF059`, `F401`, `F841`, `E741`, `SIM105/117/108`, `RUF001/005/006`, `B007/905`, `E402`. Возврат — в рамках этапа 5.

---

## Этап 2 — Зависимости и чистка

**Зачем.** В deps подозрительные версии и лишние пакеты — нельзя начинать рефакторинг кода, не зная, на каком фундаменте стоим.

**Готово когда.** Одна иконочная либа, `motion` вместо `framer-motion`, нет неиспользуемых deps, `pnpm audit` чист, `pnpm build` зелёный.

**Задачи.**

- [ ] Проверить реально установленную версию `lucide-react` (`^1.18.0` в package.json — подозрительно, у lucide-react актуальная серия 0.5xx).
  - [ ] Если это squatter/левый пакет — удалить.
  - [ ] Найти все импорты `from "lucide-react"` в `src/` (грепом).
  - [ ] Решить: оставить lucide или унифицировать на `@tabler/icons-react` (одну, не обе).
- [ ] Мигрировать `framer-motion` → `motion` (Motion v12):
  - [ ] `pnpm remove framer-motion && pnpm add motion`.
  - [ ] Заменить все импорты `from "framer-motion"` → `from "motion/react"`.
  - [ ] Проверить, что `AnimatePresence`, `motion.div`, `motion.button` работают без правок API.
- [ ] Разобраться с `pnpm-workspace.yaml`:
  - [ ] Удалить, если workspaces не используются.
  - [ ] Либо оформить как реальный workspace (вынести фронт в `apps/desktop/`, бэк остаётся `backend/`).
- [ ] Аудит фронт-зависимостей:
  - [ ] `pnpm audit` — закрыть советы по безопасности.
  - [ ] `pnpm outdated` — обновить минор-версии (React 19.1, Tauri 2.x, Tailwind 4.3 уже свежие — проверить точечно).
- [ ] Аудит бэк-зависимостей:
  - [ ] `uv pip list --outdated`.
  - [ ] При желании пин нижних границ (некоторые уже стоят: aiohttp `>=3.9,<4`, openai `>=1,<2`).
- [ ] Проверить, что `framer-motion` не остался в `pnpm-lock.yaml` после миграции на motion.
- [ ] Прогон `pnpm build && pnpm dev:all` (sanity).

---

## Этап 3 — CI и тесты-страховка

**Зачем.** Без CI следующий этап (большой рефактор `App.tsx`) превратится в гадание. Без фронт-тестов разрезание компонентов = ходьба по минному полю.

**Готово когда.** PR блокируется красным CI на любой регрессии. Базовый coverage фронта > 0%, критичные модули (`stream.ts`, обработчик ChatEvent) покрыты.

**Задачи — CI.**

- [ ] `.github/workflows/ci.yml` — три параллельных job:
  - [ ] **frontend**: setup pnpm, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm check`, `pnpm build`.
  - [ ] **backend**: setup `uv`, `uv sync` в `backend/`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest`.
  - [ ] **rust**: `cargo check` + `cargo clippy -- -D warnings` в `src-tauri/`.
- [ ] Кешировать `pnpm store`, `~/.cargo`, `~/.cache/uv` между прогонами.
- [ ] На windows-latest (это основная dev-платформа — backend завязан на PowerShell, pyautogui, ImageGrab).
- [ ] (Опционально) job-matrix по `python-version` (3.11/3.12/3.13/3.14).
- [ ] Бэйдж статуса CI в `README.md`.

**Задачи — тесты фронта.**

- [ ] `pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`.
- [ ] `vitest.config.ts` (jsdom environment, setup-файл с RTL matchers).
- [ ] Скрипты в `package.json`: `test`, `test:watch`, `test:coverage`.
- [ ] Тесты на `src/api/stream.ts` — самое критичное, NDJSON парсинг с разбиением по чанкам, неполные строки, malformed JSON, abort, network errors.
- [ ] Тесты на `src/api/client.ts` — error paths (не-200, network failure).
- [ ] Тест на `groupBlocks` в `Timeline.tsx` (чистая функция, идеальный кандидат).
- [ ] Подключить `vitest` к CI (job frontend, после lint).

**Задачи — тесты бэка.**

- [ ] Проверить, что `uv run pytest` в CI воспроизводит локальный прогон (527 passed, 12 skipped).
- [ ] При желании понизить `--cov-fail-under` (сейчас 80%) или оставить.
- [ ] Не забыть установить `tools` extra в CI, если тесты импортят pyautogui/playwright (`uv sync --extra tools`).

---

## Этап 4 — Рефакторинг `App.tsx`

**Зачем.** 601 строка, 14 `useState`, 3 синхронизируемых рефа, switch на 8 кейсов в `onEvent` — это god-component. Рефы (`assistantIdRef`/`thinkIdRef`/`toolIdRef`) расходятся с состоянием — потенциальные баги стриминга.

**Готово когда.** `App.tsx` ≤ 150 строк, состоит из композиции хуков и компоновки. Все тесты (фронт + бэк) зелёные. Поведение приложения не изменилось (визуально и по событиям).

**Подэтапы (каждый — отдельный коммит, между ними прогон тестов).**

- [ ] **4.1 — Редьюсер чата.**
  - [ ] Описать `ChatAction` union (тип на каждый ChatEvent + `commit_user`, `clear`, `init`).
  - [ ] `chatReducer(state, action)` — переносим логику из `onEvent` (App.tsx:188).
  - [ ] Состояние редьюсера: `blocks: Block[]`, `assistantId/thinkId/toolId: string | null`, `idCounter: number`.
  - [ ] Заменить `assistantIdRef`/`thinkIdRef`/`toolIdRef` на поля редьюсер-стейта.
  - [ ] Тест на редьюсер (`describe('chatReducer')` для каждого ChatEvent).

- [ ] **4.2 — `useChatSession`.**
  - [ ] Вынести: `chats`, `activeChatId`, `loadChats`, `selectChat`, `newChat`, `renameChat`, `deleteChat`.
  - [ ] Дебаунсный persist (300ms) с **флашем на `beforeunload`** — фикс бага: сейчас последний батч может теряться при закрытии окна.
  - [ ] Тест: dispatch события → blocks меняются → через 300ms `api.saveChatBlocks` вызван.

- [ ] **4.3 — `useChatStream`.**
  - [ ] Вынести: `streaming`, `abortRef`, `streamChat(payload)`, `stop()`, `handleConfirm/handleAnswer`.
  - [ ] Внутри использует dispatch из `useReducer` (передаётся через аргумент).
  - [ ] Тест: моки `streamChat`, проверка dispatch'ей в правильном порядке.

- [ ] **4.4 — `ModalsProvider`.**
  - [ ] Контекст: `showConfirm`, `showQuestion`, `showConnect` + соответствующие state.
  - [ ] Компоненты модалок остаются прежними, но рендерятся внутри `<ModalsProvider>` (не в App).
  - [ ] `useModals()` хук — `showConfirm(event)`, `showQuestion(event)`, `showConnect()`.
  - [ ] Тест: вызов хука → модалка в DOM.

- [ ] **4.5 — `useResizable` + `<ResizeHandle>`.**
  - [ ] Хук возвращает `{ width, handleProps }`, инкапсулирует mousemove/mouseup listeners.
  - [ ] `<ResizeHandle {...handleProps} />` — компонент с visuals.
  - [ ] Применить в `App.tsx` к sidebar.

- [ ] **4.6 — React 19 типы.**
  - [ ] Заменить `React.MutableRefObject` (App.tsx:169 после рефактора — мб исчезнет вместе с appendText) на `RefObject<T | null>`.
  - [ ] Проверить весь `src/` грепом на `MutableRefObject`.

- [ ] **4.7 — Единый error handler.**
  - [ ] Поставить `sonner` (или встроенный тост-компонент) — обсудим выбор.
  - [ ] Заменить все `.catch(() => {})` и `.catch(() => { /* ignore */ })` на `.catch((err) => toast.error(...))`.
  - [ ] Критичные операции: `api.saveChatBlocks`, `api.connect`, `api.selectChat`, `api.setModel`, `api.deleteChat`, `streamChat`.

- [ ] **4.8 — Чистка JSX-техдолга из этапа 1.**
  - [ ] Добавить `type="button"` ко всем 22 `<button>` без `type` (правило `useButtonType`).
  - [ ] Добавить `<title>` к 4 SVG (`noSvgWithoutTitle`) — иконки получают aria-label.
  - [ ] Заменить index-as-key на стабильные id (`noArrayIndexKey` — 4 места: ConfirmModal, QuestionModal, Timeline x2).
  - [ ] Resize handle и Tooltip: либо `role="separator"`/`role="tooltip"` + `tabIndex`, либо подавление правила точечно.
  - [ ] Поднять правила в `biome.json` обратно с `warn` на `error`.

---

## Этап 5 — Шлифовка и масштабируемость

**Зачем.** Этап 4 заложил архитектуру, теперь — закрыть оставшиеся "плохие места", чтобы проект был готов к росту и приём новых агентов был приятным.

**Готово когда.** Doc'и актуальные, pre-commit ловит грязь до коммита, mypy и pytest зелёные, ruff без `ignore`-листа из этапа 1.

**Задачи.**

- [ ] **Роутер.**
  - [ ] `pnpm add @tanstack/react-router @tanstack/router-devtools` (либо react-router 7).
  - [ ] Маршруты `/`, `/chat/:id`, `/skills`.
  - [ ] `view: "chat" | "skills"` из App убирается, переезжает в роутер.
  - [ ] Sidebar навигация через `<Link>` вместо callback'ов.

- [ ] **Реструктура backend-тестов.**
  - [ ] Создать `backend/tests/` зеркальной структурой к `agent/` (`tests/test_chat.py`, `tests/memory/test_aggregator.py` и т.д.).
  - [ ] Перенести `agent/test_*.py` → `tests/`.
  - [ ] Перенести `agent/conftest.py` в `tests/conftest.py` (общие фикстуры) и подмодульные `tests/<...>/conftest.py` если нужны.
  - [ ] Обновить `[tool.pytest.ini_options] testpaths = ["tests"]`.

- [ ] **mypy.**
  - [ ] `uv add --dev mypy`.
  - [ ] `[tool.mypy]` в pyproject: `python_version = "3.11"`, `strict = true` для `agent/`, плюс мягкие исключения для тех модулей, где быстро не починить.
  - [ ] Прогон в CI (job backend, после ruff).

- [ ] **Закрыть ruff-техдолг.**
  - [ ] Удалить ignore-список из `[tool.ruff.lint] ignore` (RUF012, F401, F841, E741, SIM* и т.д.).
  - [ ] Поправить нарушения (~150 штук — большая часть автофиксается с `--unsafe-fixes`).

- [ ] **`src/data/mock.ts`.**
  - [ ] Проверить, импортируется ли где-то в продакшн-коде.
  - [ ] Если нет — удалить. Если да — перенести под `__mocks__/` или сделать импорт через `import.meta.env.DEV`.

- [ ] **Документация.**
  - [ ] Обновить `docs/architecture.md` под новую структуру фронта (роутер, хуки, ModalsProvider, useChatSession/useChatStream).
  - [ ] Обновить раздел "Где искать правду" — реальные пути после рефактора.
  - [ ] В `CLAUDE.md` удалить раздел Tech Debt (или оставить пустым с пометкой "ничего не висит").

- [ ] **Pre-commit хуки.**
  - [ ] Фронт: `pnpm add -D simple-git-hooks lint-staged`.
    - [ ] `package.json`: `"simple-git-hooks": { "pre-commit": "pnpm exec lint-staged" }`.
    - [ ] `lint-staged`: `*.{ts,tsx,json}` → `biome check --write --no-errors-on-unmatched`.
  - [ ] Бэк: установить `pre-commit` framework (Python).
    - [ ] `.pre-commit-config.yaml`: ruff lint + ruff format на `*.py` в `backend/`.
  - [ ] Документировать в `docs/setup.md`: `pnpm exec simple-git-hooks` после клона.

- [ ] **Финал.**
  - [ ] Прогон полного CI на main.
  - [ ] Update `README.md` (если что-то поменялось в high-level описании).
  - [ ] Этот файл можно архивировать в `docs/history/2026-plan-stage1-5.md` или удалить.
