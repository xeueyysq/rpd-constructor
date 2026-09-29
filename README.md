# Методический конструктор

Веб-приложение университета «Дубна» для подготовки рабочих программ дисциплин (РПД). В нём загружают комплекты из 1С, распределяют шаблоны между преподавателями, заполняют разделы РПД, выгружают документ в PDF и Word и собирают ФОС.

## Состав репозитория

| Каталог | Что это |
| --- | --- |
| `rpd-server/` | API: Express 5 и PostgreSQL на TypeScript/ESM без сборки, генерация PDF (Puppeteer) и DOCX |
| `rpd-client-ts/` | Клиент: React 19, TypeScript, Vite 8, Feature-Sliced Design, MUI 9 |
| `e2e/` | Сценарии Playwright против настоящих сервера и клиента на тестовой БД |
| `docs/CONVENTIONS.md` | Правила разработки и проверки перед передачей изменений |
| `CHANGELOG.md` | История версий и шаги обновления между ними |

У каждого проекта свои `package.json` и `bun.lock`, менеджер пакетов — bun.

## Требования

- bun 1.3;
- Node.js 22.18+ (type stripping);
- PostgreSQL 16, локально или в Docker;
- Docker — для e2e.

## Запуск для разработки

Сервер:

```bash
cd rpd-server
bun install
bun run migrate   # применить новые миграции из app/migrations/versions (журнал schema_migrations)
bun run dev       # node --watch, порт из PORT
```

Новую миграцию создавайте командой `bun run migrate:new <имя>`; правила — в [CONVENTIONS.md](docs/CONVENTIONS.md#сервер-и-данные).

Серверу нужны переменные `PORT`, `CLIENT_URL`, `API_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ACCESS_TOKEN_SECRET` и `REFRESH_TOKEN_SECRET`. Команды `dev`, `start` и `migrate` читают `rpd-server/.env` через флаг Node `--env-file-if-exists`; переменные окружения процесса имеют приоритет над файлом. Без `DB_*` используются значения по умолчанию из `config/db.ts` (`localhost:5432`, БД `Rpd`).

Клиент:

```bash
cd rpd-client-ts
bun install
bun run dev       # http://localhost:5173
```

`VITE_API_URL` в `rpd-client-ts/.env` задаёт адрес API, например `http://localhost:8000`. Если оставить значение пустым, клиент обращается к относительным `/api` и `/auth`, а Vite проксирует их на `http://localhost:8000`.

Импорт из 1С выполняется через API сервера и требует доступа к 1С.

## Проверки

| Проект | Команда |
| --- | --- |
| `rpd-client-ts/` | `bun run lint && bun run typecheck && bun run build && bun run test` |
| `rpd-server/` | `bun run lint && bun run typecheck && bun run test` |
| `e2e/` | `bun run test:e2e` — нужен Docker, в быстрые проверки не входит |

Правила кода, слоёв FSD, коммитов и тестов описаны в [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

## E2E

```bash
cd e2e
bun install
bunx playwright install chromium
bun run test:e2e   # сброс тестовой БД, миграции, seed, прогон Playwright
bun run db:down    # остановить тестовую БД
```

`test:e2e` пересоздаёт PostgreSQL 16 в Docker на `127.0.0.1:5433`, применяет миграции сервера и синтетический `e2e/seed.sql`. Затем Playwright поднимает сервер на порту 8010 и клиент на 5180 и прогоняет сценарии в Chromium. Рабочую БД сброс не трогает. Все значения лежат в `e2e/e2e.env` и перекрывают переменные shell.

В seed есть пользователи `admin`, `rop`, `teacher`, `teacher2` и `nofio` (без ФИО) с паролем `e2e-password`. Отчёт последнего прогона открывает `bunx playwright show-report`.

### Какие сценарии запускать

Сценарии разложены по папкам `e2e/tests/<группа>/`. После фичи или фикса запускайте группу своей области, а перед PR или `but land` — весь набор (`bun run test:e2e`). Каждая команда заново сбрасывает БД (около 15 с), поэтому группа проходит примерно за 20–50 с, а весь набор — около полутора минут.

| Что менялось | Команда |
| --- | --- |
| Вход, токены, refresh (`Auth`, `Token`, `entities/auth`, `pages/sign-in`) | `bun run test:e2e:auth` |
| Пользователи и их активность (`usersController`, `services/User`, `pages/user-management`) | `bun run test:e2e:users` |
| Комплекты, назначение преподавателей, статусы и отметки, изменения 1С, права РОП, PDF/DOCX, ФОС (`TemplateWorkflow`, `TemplateAccess`, `Complects`, `pdf-generator`, `pages/rpd-complect*`, `pages/teacher-interface-templates`, `features/assign-teachers`, `template-workflow`, `complect-sync`) | `bun run test:e2e:complects` |
| Редактор РПД: открытие, сохранение по blur, совместная работа, комментарии РОП, часы, поиск книг (`rpd_profile_templates`, `fieldEdits`, `TemplatePresence`, `findBooks`, `find-books`, `pages/teacher-interface`, `entities/template`, `features/discipline-evaluations-funds`) | `bun run test:e2e:editor` |
| Общее: `seed.sql`, `tests/helpers.ts`, миграции, `shared/api`, маршрутизация, `playwright.config.ts` | `bun run test:e2e` |

Если изменение задевает несколько областей, запустите несколько групп подряд или весь набор. Точечно:

```bash
bun run test:e2e tests/editor/collaboration.spec.ts   # один файл
bun run test:e2e tests/editor -g "конфликт"           # тесты группы по части названия
```

Новый сценарий кладите в папку своей области. Если область новая, заведите папку и скрипт `test:e2e:<группа>` в `e2e/package.json` и добавьте строку в таблицу выше.

### Документация

Страница инструкции лежит в `rpd-client-ts/public/docs/index.html`, стили и снимки — рядом в `css/` и `media/`.
Чтобы переснять экраны на синтетическом seed, выполните `cd e2e && bun run docs:screenshots`; команда заново сбрасывает тестовую БД.
После съёмки просмотрите все PNG в `rpd-client-ts/public/docs/media/` и проверьте выноски перед публикацией.

## Развёртывание

`rpd-server/docker-compose.yml` собирает клиент (nginx, порты 8080 и 443), сервер (порт 8000) и `postgres:16`. Серверу нужен `rpd-server/.env`. Пересборку и перезапуск выполняет `rpd-server/docker.sh`.

Выкладывается ветка `main`, каждая версия отмечена тегом `vX.Y.Z`. Перед обновлением прочитайте раздел версии в [CHANGELOG.md](CHANGELOG.md): если выкладка требует миграций или других ручных шагов, они описаны там. Порядок выпуска — в [docs/CONVENTIONS.md](docs/CONVENTIONS.md#версии-и-релизы).
