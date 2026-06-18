# TODO

10 пакетов для внедрения. Тип и что даёт — кратко.

---

**1. zod** — *библиотека-схемер*

Проверяет ответы бэкенда в рантайме. Если бэкенд прислал не то поле — ошибка с путём (`"status.model: Required"`), а не `undefined is not a function`.

→ `pnpm add zod`
→ новый `src/api/schemas.ts`, правка `client.ts`

---

**2. MSW (Mock Service Worker)** — *пакет-перехватчик для тестов*

Перехватывает fetch в тестах на уровне сети. Тест не знает что бэкенд поддельный — код тот же что в проде. Никаких `vi.mock`, никакой зависимости от запущенного Python.

→ `pnpm add -D msw`
→ новый `src/test/msw/`, правка `setup.ts`

---

**3. zustand** — *библиотека-состояние (store)*

Выносит 15 `useState` + 4 `useRef`-кеша из App.tsx в сторы. Компоненты читают состояние напрямую: `useChatStore(s => s.chats)`. App.tsx худеет с 690 → ~300 строк.

→ `pnpm add zustand`
→ новый `src/stores/chat.ts session.ts view.ts blocks.ts`

---

**4. TanStack Query** — *библиотека для запросов (data-fetching)*

Кеш, ретраи, deduplication (два компонента не шлют один запрос), stale-while-revalidate. Вместо 40 ручных `useCallback` + `useState` + `try/catch`. Переключил чат туда-сюда — данные из кеша, не с бэкенда.

→ `pnpm add @tanstack/react-query`
→ новый `hooks/queries/`, правка `main.tsx App.tsx`

---

**5. ky** — *HTTP-клиент (1KB)*

Замена ручного fetch в `client.ts`. `ky.post("/connect", { json: { api_key } }).json()`. JSON парсится сам, таймауты, ретраи, `prefixUrl` для базового URL.

→ `pnpm add ky`
→ правка `src/api/client.ts`

---

**6. es-toolkit** — *набор утилит (lodash без веса)*

`debounce`, `throttle`, `uniqBy`, `groupBy`, `pick`. Убирает самописные setTimeout-велосипеды из 4 хуков. Tree-shakeable — в бандл летит только то что юзаешь.

→ `pnpm add es-toolkit`
→ замена ручных debounce/timer в хуках

---

**7. @tauri-apps/plugin-dialog** — *плагин Tauri для диалогов ОС*

Настоящее виндовое окно «Открыть файл» / «Сохранить файл» вместо `<input type="file">` из браузера. С фильтрами, выбором папок, запоминанием последнего пути.

→ `pnpm add @tauri-apps/plugin-dialog`
→ добавить в `Cargo.toml`, правка `InputBar.tsx`

---

**8. react-hotkeys-hook** — *пакет для хоткеев*

`useHotkeys("ctrl+k", () => openPalette())` — одна строка вместо `useEffect` + `addEventListener("keydown")` + ручной проверки `e.key`. Escape, Ctrl+N, Ctrl+Shift+C — добавляются за секунду.

→ `pnpm add react-hotkeys-hook`
→ правка `App.tsx`

---

**9. @tanstack/react-virtual** — *библиотека виртуального списка*

Если в чате 500 сообщений — рендерятся только те что видны на экране (20-30 шт). Остальные — пустышки по высоте. Список любой длины не тормозит.

→ `pnpm add @tanstack/react-virtual`
→ правка `Timeline.tsx`

---

**10. consola** — *библиотека для логов*

`consola.error` — красный, `consola.warn` — жёлтый, `consola.success` — зелёный. Вместо серого `console.error`. Сразу видно что важно.

→ `pnpm add consola`
→ замена `console.*` по всему `src/`

---

## Рекомендуемый порядок

```
1. ky           — день    (механическая замена в client.ts)
2. consola      — день    (механическая замена)
3. es-toolkit   — день    (замена ручных timer/debounce)
4. react-hotkeys-hook — день (добавление хоткеев)
5. zod          — 1-2 дня (схемы на все API-ответы)
6. @tauri-apps/plugin-dialog — день (Tauri-сторона)
7. @tanstack/react-virtual   — 1-2 дня (Timeline)
8. MSW          — 2 дня   (хендлеры + тесты)
9. zustand      — 3-4 дня (постепенно, по сторам)
10. TanStack Query — 3-5 дней (через zustand или отдельно)
```

Первые 4 — механические замены, не трогают логику. Дальше нарастает сложность.
