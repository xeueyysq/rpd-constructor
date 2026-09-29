# Методический конструктор

Веб-приложение университета «Дубна» для подготовки рабочих программ дисциплин (РПД). В нём загружают комплекты из 1С, распределяют шаблоны между преподавателями, заполняют разделы РПД, выгружают документ в PDF и Word и собирают ФОС.

## Состав репозитория

| Каталог | Что это |
| --- | --- |
| `rpd-server/` | API: Express 5 и PostgreSQL на TypeScript/ESM без сборки, генерация PDF (Puppeteer) и DOCX |
| `rpd-client-ts/` | Клиент: React 19, TypeScript, Vite 8, Feature-Sliced Design, MUI 9 |
| `deploy/` | Прод: Compose, скрипт выкладки и образец `.env` |
| `dev/` | PostgreSQL 17 для локальной разработки |
| `e2e/` | Сценарии Playwright против настоящих сервера и клиента на тестовой БД |
| `docs/CONVENTIONS.md` | Правила разработки и проверки перед передачей изменений |
| `CHANGELOG.md` | История версий и шаги обновления между ними |

У каждого проекта свои `package.json` и `bun.lock`, менеджер пакетов — bun.

## Требования

- bun 1.3;
- Node.js 22.18+ (type stripping);
- Docker с Compose v2 — для локальной БД, e2e и выкладки;
- PostgreSQL 17 — через `dev/compose.yaml` или локальную установку.

## Запуск для разработки

Из корня репозитория запустите PostgreSQL:

```bash
docker compose -f dev/compose.yaml up -d
cp rpd-server/.env.example rpd-server/.env
```

Если порт 5432 занят, задайте `DEV_DB_PORT` для Compose и тот же номер в `DB_PORT` файла `rpd-server/.env`.

Сервер:

```bash
cd rpd-server
bun install
bun run migrate   # применить новые миграции из app/migrations/versions (журнал schema_migrations)
bun run dev       # node --watch, порт из PORT
```

Новую миграцию создавайте командой `bun run migrate:new <имя>`; правила — в [CONVENTIONS.md](docs/CONVENTIONS.md#сервер-и-данные).

Команды `dev`, `start` и `migrate` читают `rpd-server/.env` через флаг Node `--env-file-if-exists`; переменные окружения процесса имеют приоритет над файлом. Образец содержит настройки для `dev/compose.yaml`. Для прода используется отдельный `deploy/.env`.

Клиент:

```bash
cd rpd-client-ts
bun install
bun run dev       # http://localhost:5173
```

При пустом `VITE_API_URL` клиент обращается к относительным `/api` и `/auth`, а Vite проксирует их на `http://localhost:8000`.

Для остановки БД выполните из корня `docker compose -f dev/compose.yaml down`: данные сохранятся в томе. Команда `docker compose -f dev/compose.yaml down -v` удалит том вместе с данными разработки.

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

`test:e2e` пересоздаёт PostgreSQL 17 в Docker на `127.0.0.1:5433`, применяет миграции сервера и синтетический `e2e/seed.sql`. Затем Playwright поднимает сервер на порту 8010 и клиент на 5180 и прогоняет сценарии в Chromium. Рабочую БД сброс не трогает. Все значения лежат в `e2e/e2e.env` и перекрывают переменные shell.

В seed есть пользователи `admin`, `rop`, `teacher`, `teacher2` и `nofio` (без ФИО) с паролем `e2e-password`. Отчёт последнего прогона открывает `bunx playwright show-report`.

### Какие сценарии запускать

Сценарии разложены по папкам `e2e/tests/<группа>/`. После фичи или фикса запускайте группу своей области, а перед PR или `but land` — весь набор (`bun run test:e2e`). Каждая команда заново сбрасывает БД (около 15 с), поэтому группа проходит примерно за 20–50 с, а весь набор — около полутора минут.

| Что менялось | Команда |
| --- | --- |
| Вход, токены, refresh (`Auth`, `Token`, `entities/auth`, `pages/sign-in`) | `bun run test:e2e:auth` |
| Пользователи и их активность (`usersController`, `services/User`, `pages/user-management`) | `bun run test:e2e:users` |
| Комплекты, назначение преподавателей, статусы и отметки, изменения 1С, права РОП, PDF/DOCX, ФОС (`TemplateWorkflow`, `TemplateAccess`, `Complects`, `pdf-generator`, `pages/rpd-complect*`, `pages/teacher-interface-templates`, `features/assign-teachers`, `template-workflow`, `complect-sync`) | `bun run test:e2e:complects` |
| Редактор РПД: открытие, сохранение по blur, совместная работа, комментарии РОП, часы, поиск книг (`rpd_profile_templates`, `fieldEdits`, `TemplatePresence`, `findBooks`, `find-books`, `pages/teacher-interface`, `entities/template`, `features/discipline-evaluations-funds`) | `bun run test:e2e:editor` |
| Health API и продовая конфигурация (`/api/health`, `server.ts`, `deploy/compose.yaml`, `nginx.conf`) | `bun run test:e2e:system` |
| Выкладка (`deploy/deploy.sh`, `deploy/compose.yaml`, Dockerfile, миграции) | `bun run test:deploy` — отдельно от общего набора, со сборкой образов |
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

На проде системный nginx завершает TLS для `rpd.uni-dubna.ru` и передаёт запросы на `127.0.0.1:8080`. Контейнер клиента проксирует `/api/` и `/auth/` в сервер. Порты клиента и API привязаны к localhost; PostgreSQL 17 хранит данные в томе `rpd-server_postgres_data`. Имя Compose-проекта `rpd-server` менять нельзя: от него зависит имя тома.

Создайте `deploy/.env` по [образцу](deploy/.env.example), задайте пароль БД, отдельные секреты и адреса домена. Файл исключён из git. `DB_USER`, `DB_PASSWORD` и `DB_NAME` задают учётные данные при первом создании тома; на существующем томе их изменение не меняет пользователя и пароль БД.

```bash
cd ~/rpd-app/rpd-constructor/deploy
./deploy.sh vX.Y.Z     # либо ./deploy.sh — последний тег v* из origin/main
```

Скрипт проверяет окружение и чистоту отслеживаемых файлов, загружает теги, проверяет версии пакетов, показывает план и собирает образы при работающей старой версии. Затем останавливает API, создаёт и проверяет дамп, применяет миграции и запускает сервер и клиент. После успешного `/api/health` выкладка завершена; ошибки записи `current`/`history.log` или очистки старых дампов и образов выводятся как предупреждения и не запускают откат. Сохраняются последние 10 дампов и образы текущего и предыдущего тегов. `--yes` отключает вопрос; `--init` нужен только для первой установки без тома и пропускает дамп.

При сбое между остановкой API и успешным health check скрипт сравнивает журнал миграций и при изменении или ошибке чтения восстанавливает БД из дампа. Затем возвращает прежний HEAD и образы, если они доступны. После успешного health check автоматического отката уже нет. При переходе с 1.x старые образы имеют другие имена; если прежний контейнер уже пересоздан, поднимите его из старого каталога. С `--init` данных для восстановления нет. Записи в БД после дампа при откате не сохраняются; результат проверяйте в логе.

Состояние лежит в `${RPD_DEPLOY_DIR:-$HOME/rpd-deploy}`: `backups/` — дампы, `logs/` — журналы, `current` — последний успешный тег, `history.log` — история, `lock` — блокировка. После аварийного завершения проверьте состояние и вручную удалите оставшийся `lock`. Настройки окружения: `RPD_DEPLOY_DIR` (каталог состояния), `RPD_GIT_REMOTE` (`origin`), `RPD_KEEP_BACKUPS` (`10`), `RPD_WAIT_TIMEOUT` (`180` секунд), `RPD_HTTP_PORT` (`8080`) и `RPD_API_PORT` (`8000`). `COMPOSE_PROJECT_NAME` меняет имя проекта для отдельной среды или теста.

Для ручного восстановления дампа остановите API и выполните из `deploy/` (подставьте путь к файлу):

```bash
docker compose -f compose.yaml -p rpd-server stop server
docker compose -f compose.yaml -p rpd-server exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -v dbname="$POSTGRES_DB"' <<'SQL'
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'dbname') \gexec
SELECT format('CREATE DATABASE %I', :'dbname') \gexec
SQL
docker compose -f compose.yaml -p rpd-server exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' < /путь/к/дампу.dump
```

После восстановления запустите нужную версию сервера и клиента через Compose и проверьте `/api/health`. Перед релизом, меняющим миграции или выкладку, выполните `cd e2e && bun run test:deploy`. Репетиция создаёт отдельный проект `rpd-deploy-test` и собирает образы, поэтому выполняется дольше обычных E2E.

### Первый переход с 1.x

Клонируйте монорепо в `~/rpd-app/rpd-constructor`, скопируйте `~/rpd-app/rpd-server/.env` в `~/rpd-app/rpd-constructor/deploy/.env` и дополните по `deploy/.env.example`. Старые отдельные клоны сохраните для ручного отката. Убедитесь, что том `rpd-server_postgres_data` существует, и запустите `./deploy.sh vX.Y.Z` из `~/rpd-app/rpd-constructor/deploy` без `--init`. Если откат не смог поднять прежнюю версию, выполните `cd ~/rpd-app/rpd-server && docker compose up -d`; состояние БД проверьте по логу выкладки.

Перед релизом прочитайте раздел версии в [CHANGELOG.md](CHANGELOG.md) и порядок выпуска в [CONVENTIONS.md](docs/CONVENTIONS.md#версии-и-релизы).
