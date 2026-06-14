# Warden Desktop Docs

Это короткая карта проекта. Здесь нет правил для контрибьюторов; эти документы нужны, чтобы быстро понять, что это за приложение, из каких частей оно собрано и как его запустить.

## Что читать

- [project.md](project.md) — что делает проект и где его границы.
- [architecture.md](architecture.md) — как связаны desktop UI, Tauri и backend.
- [setup.md](setup.md) — как поднять проект локально и собрать приложение.

## Структура документации

```text
docs/
  README.md        # входная точка
  project.md       # о проекте
  architecture.md  # как устроено
  setup.md         # как запустить и собрать
```

## Быстрая карта проекта

```text
warden-desktop/
  backend/         # Python backend: agent runtime, tools, memory, skills
  src/             # React UI для desktop-приложения
  src-tauri/       # Tauri shell, окно, сборка desktop-приложения
  scripts/         # dev/build scripts для backend
  public/          # статические frontend assets
  dist/            # результат frontend build
```
