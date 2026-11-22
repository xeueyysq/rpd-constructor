# Методический конструктор

Веб-приложение университета «Дубна» для подготовки рабочих программ дисциплин (РПД). Оно загружает учебные планы из 1С, распределяет РПД между преподавателями и формирует PDF, Word и фонды оценочных средств.

Сервер в [`rpd-server/`](rpd-server/) использует Express 5, TypeScript и PostgreSQL 17. Клиент в [`rpd-client-ts/`](rpd-client-ts/) использует React 19, TypeScript, Vite 8 и MUI 9.

## Запуск для разработки

Понадобятся Node.js 22.18+, Bun 1.3 и Docker с Compose v2. Подготовьте БД и `.env` из корня репозитория.

```bash
docker compose -f dev/compose.yaml up -d --wait
test -f rpd-server/.env || cp rpd-server/.env.example rpd-server/.env
```

Запустите сервер в отдельном терминале.

```bash
cd rpd-server
bun install
bun run migrate
bun run dev
```

Запустите клиент в другом терминале, начиная из корня репозитория.

```bash
cd rpd-client-ts
bun install
bun run dev
```

Откройте [клиент](http://localhost:5173). По умолчанию Vite проксирует `/api` и `/auth` на `http://localhost:8000`. Если порт БД `5432` занят, запустите Compose с `DEV_DB_PORT` и укажите тот же порт в `DB_PORT` файла `rpd-server/.env`. Для импорта учебных планов нужен доступ к 1С.

## Проверки

Команды lint, typecheck, сборки и тестов для каждого пакета описаны в [правилах проекта](docs/CONVENTIONS.md#проверки). Для E2E сначала установите зависимости клиента и сервера. Следующие команды запускаются из корня репозитория.

```bash
cd e2e
bun install
bunx playwright install chromium
bun run test:e2e
bun run db:down
```

E2E пересоздаёт отдельную тестовую БД на порту `5433`. Для запуска одной группы используйте `bun run test:e2e:<группа>`.

| Группа | Область |
| --- | --- |
| `auth` | Вход и сессии |
| `users` | Управление пользователями |
| `complects` | Комплекты, права, импорт и экспорт |
| `editor` | Редактор РПД и совместная работа |
| `system` | Health API, обращения и диагностика |

Репетиция выкладки из `e2e/` запускается через `bun run test:deploy`.

## Развёртывание

Подготовьте `deploy/.env` по [шаблону](deploy/.env.example) и запустите `./deploy.sh vX.Y.Z` из каталога `deploy/`. Скрипт делает дамп, применяет миграции и обновляет контейнеры. GitHub Actions проверяет PR в `develop` и `main`, а при обычном релизе собирает образы и запускает выкладку. Для релизов с ручными шагами следуйте [истории версий](CHANGELOG.md) и [порядку выпуска](docs/CONVENTIONS.md#версии-и-релизы).

### Первое включение обращений

Локальный приём (`FEEDBACK_ENABLED`) и доставка в Google Sheets (`FEEDBACK_GOOGLE_ENABLED`) включаются отдельно. Для Google предоставьте сервисному аккаунту роль редактора, проверьте заголовки целевого листа и подключите ключ вне checkout с правами `600` через [Compose overlay](deploy/compose.feedback.yaml). Команды проверки Google и настройки nginx для обращений и импорта Word собраны в [инструкции v2.7.0](https://github.com/xeueyysq/rpd-constructor/blob/v2.7.0/README.md#развёртывание).

### Выкладка и откат

Перед откатом проверьте совместимость миграций со старой версией. Команды обновления образов и восстановления предрелизного дампа приведены в [инструкции v2.7.0](https://github.com/xeueyysq/rpd-constructor/blob/v2.7.0/README.md#выкладка-и-откат).

## Документация

- [Инструкция пользователя](rpd-client-ts/public/docs/index.html)
- [Настройка библиотечных каталогов](rpd-server/README.md#поиск-литературы-в-эбс)
- [Правила разработки](docs/CONVENTIONS.md) и [правила интерфейса](docs/DESIGN.md)
