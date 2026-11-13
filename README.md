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
| Health API, обращения, диагностика и продовая конфигурация (`/api/health`, `/api/feedback`, `server.ts`, `deploy/compose.yaml`, `nginx.conf`) | `bun run test:e2e:system` |
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

На сервере нужны Git, Docker и Compose 2.17.0+. Системный nginx завершает TLS для `rpd.uni-dubna.ru` и передаёт запросы на `127.0.0.1:8080`. Контейнер клиента проксирует `/api/` и `/auth/` в сервер. Порты HTTP и API привязаны к localhost. Compose-проект — `rpd-server`, том PostgreSQL 17 — `rpd-server_postgres_data`.

### Импорт из Word

Предпросмотр `POST /api/templates/{id}/import-word/preview` принимает один DOCX до 5 МиБ; тело multipart — до 6 МиБ. Архив может содержать не более 25 МиБ распакованных данных. Одновременно разбирается один файл; разбор ограничен 10 секундами. Если слот занят или лимит превышен, повторите попытку позже либо выберите файл поменьше. Предпросмотр не сохраняет данные. Оператор выбирает совместимые содержательные поля и подтверждает режим добавления или замены; `apply` проверяет права и ревизию цели. Данные 1С, идентичность дисциплины, компетенции и ФОС не переносятся. При неоднозначных часах соответствующее поле пропускается с предупреждением.

Во внешнем nginx добавьте в существующий `server` путь для Word-предпросмотра. Точные параметры проксирования и заголовки должны совпадать с действующим `/api/`; ограничение 3 МиБ для `/api/feedback` и общий лимит остальных маршрутов сохраняются. Внутренний прокси уже содержит этот маршрут:

```nginx
location ~ ^/api/templates/[A-Za-z0-9_-]+/import-word/preview$ {
    client_max_body_size 6m;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $http_x_request_id;
}
```

Перед применением проверьте синтаксис обоих уровней командой `nginx -t`. Затем отправьте DOCX с телом между 3 и 6 МиБ на точный путь предпросмотра и убедитесь, что nginx пропускает его к серверу; тело больше 6 МиБ должно получить 413. Тот же файл на другой маршрут не должен наследовать этот лимит.

### Обращения и доставка в Google Sheets

При `FEEDBACK_ENABLED=true` сервер принимает обращения в PostgreSQL и обслуживает очередь в том же Node-процессе. По умолчанию флаг выключен. Миграции `0006` и `0007` должны быть применены до включения. `FEEDBACK_GOOGLE_ENABLED=false` оставляет локальный приём работающим без подключения к Google. Квитанция `RPD-…` означает, что обращение и запись очереди сохранены локально; она не подтверждает доставку в Google. Повторная отправка того же `clientReportId` тем же пользователем возвращает прежнюю квитанцию. Скриншоты удаляются через 30 дней, записи через 90 дней после успешной доставки; очередь с недоставленными записями сохраняется. Суммарный лимит скриншотов — 512 МиБ: при его достижении текст принимается с предупреждением, изображение не сохраняется. Скриншоты лежат в PostgreSQL как `bytea` и входят в обычный дамп БД, увеличивая его размер. Администратор видит готовность, backlog, возраст старейшей записи и безопасный код последней ошибки через `/api/feedback/delivery-status`.

В таблице `1T9z4JW_Lf27eXX1ONo4sqC8e_N5-0kS1b8Q6cn7pF7w` используется лист `Обращения` с точной строкой A1:K1: `Код | Дата | Тип | Кратко | Приоритет | Статус | Комплект / дисциплина | Версия | Повторы | Последний случай | Диагностика`. До включения проверьте эти заголовки и доступ сервисного аккаунта к таблице. Приложение обращается только к листу `Обращения`; листы `вход` и `статусыРПД` не используются. Значения пишутся как `RAW`; код в A служит устойчивым идентификатором. Новая строка получает статус `Новое` и приоритет `Высокий` для блокирующего обращения или критического сбоя, иначе `Средний`. Оператор меняет статус и приоритет в столбцах F/E вручную; при повторной доставке приложение обновляет только I:J и сохраняет остальные правки. Доставка гарантирует повторные попытки, но не однократное добавление: после неопределённого ответа Google воркер ищет код в A и может обнаружить дубликат. При дублировании кода или изменении заголовка доставка останавливается с безопасным кодом ошибки; устраните проблему в листе и проверьте backlog, не удаляя обращение из PostgreSQL.

Храните JSON-ключ сервисного аккаунта отдельным файлом на хосте вне checkout с правами чтения для Docker; не включайте его в образ, Git или общий каталог миграций. Для подключения только к контейнеру `server` задайте `FEEDBACK_GOOGLE_CREDENTIALS_HOST_FILE=/абсолютный/путь/к/ключу.json` и экспортируйте `COMPOSE_FILE=compose.yaml:compose.feedback.yaml` перед `./deploy.sh`. В `deploy/.env` задайте `FEEDBACK_ENABLED=true`, `FEEDBACK_GOOGLE_ENABLED=true`, `FEEDBACK_PUBLIC_BASE_URL=https://rpd.uni-dubna.ru`; при необходимости переопределите `FEEDBACK_GOOGLE_SPREADSHEET_ID` и `FEEDBACK_GOOGLE_SHEET_NAME` (по умолчанию указанные выше). `FEEDBACK_GOOGLE_CREDENTIALS_FILE` задаёт override внутри контейнера. Секрет не монтируется в `migrate`. При отсутствующей или неверной настройке Google существующий сервер запускается, локальные квитанции продолжают выдаваться, а статус доставки показывает причину без содержимого ключа.

Во внешнем nginx добавьте в существующий `server` точный путь; перенесите в него остальные заголовки из действующего прокси, если они есть. Клиент посылает UUID в `X-Request-ID`; оба прокси передают его без генерации альтернативного значения, сервер проверяет UUID и создаёт новый при отсутствующем или некорректном заголовке:

```nginx
location = /api/feedback {
    client_max_body_size 3m;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-ID $http_x_request_id;
}
```

Во внутреннем `rpd-client-ts/nginx.conf` уже задан такой же точный путь с лимитом 3 МиБ и теми же заголовками, что у `/api/`. Общий лимит для прочих путей сохранён; серверный маршрут принимает только POST. До включения проверьте конфигурацию обоих уровней nginx, применённые миграции, наличие листа и доступ сервисного аккаунта. Затем включите `FEEDBACK_ENABLED` отдельно от Google, отправьте пробное обращение в dev и проверьте квитанцию и `/api/feedback/delivery-status` под активным администратором. В E2E флаг включён, доставка в Google выключена. Для отката выключите `FEEDBACK_ENABLED`; новые таблицы совместимы со старой версией приложения и могут оставаться в БД. Пользователь проверяет интерфейс в dev до релиза; эти инструкции сами по себе не разрешают выкладку.

Выкладка на сервере:

```bash
cd ~/rpd-app/rpd-constructor/deploy
./deploy.sh vX.Y.Z
```

Скрипт получает тег, запускает дамп и миграции, обновляет контейнеры образами `ghcr.io/xeueyysq/rpd-{server,client}:vX.Y.Z` и ждёт готовности API до 180 секунд. Дампы лежат в `${RPD_BACKUP_DIR:-$HOME/rpd-deploy/backups}`; сохраняются последние 10 и образы текущего и предыдущего тегов. Переменные `RPD_HTTP_PORT` и `RPD_API_PORT` меняют порты `8080` и `8000`.

Откат образов из каталога `deploy/`:

```bash
RPD_VERSION=vX.Y.Z docker compose up -d --wait
```

Если после дампа применялись миграции, перед запуском прежнего тега восстановите БД из дампа перед обновлением:

```bash
export RPD_VERSION=vX.Y.Z
docker compose stop server
docker compose exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -v dbname="$POSTGRES_DB"' <<'SQL'
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'dbname') \gexec
SELECT format('CREATE DATABASE %I', :'dbname') \gexec
SQL
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' < "$HOME/rpd-deploy/backups/имя.dump"
docker compose up -d --wait
```

Подставьте прежний тег и имя дампа; при заданном `RPD_BACKUP_DIR` используйте этот каталог. Восстановление возвращает данные на момент дампа.

### Первая установка

```bash
git clone https://github.com/xeueyysq/rpd-constructor.git ~/rpd-app/rpd-constructor
cd ~/rpd-app/rpd-constructor/deploy
cp .env.example .env
```

Заполните `.env`: пароль БД, отдельные секреты токенов и адреса домена. `DB_USER`, `DB_PASSWORD` и `DB_NAME` задают учётные данные при первом создании тома. Затем выполните `./deploy.sh vX.Y.Z`; миграции создадут схему на пустом томе.

Репетиция выкладки: `cd e2e && RPD_HTTP_PORT=18090 bun run test:deploy`. Тест собирает образы локально, использует отдельные контейнеры, том и каталог дампов и удаляет их после завершения. HTTP/API-порты задаются через `RPD_HTTP_PORT`/`RPD_API_PORT` (по умолчанию `18080`/`18000`).

### CI/CD (GitHub Actions)

- CI (`checks.yml`) — на PR в `develop` и `main`: gate клиента и сервера, затем E2E; также вызывается из CD.
- CD (`release.yml`) — при публикации обычного релиза: CI, сборка и публикация образов в GHCR; если в заметках релиза нет `### Ручные шаги`, выкладка по SSH автоматическая, иначе выполните ручные шаги из CHANGELOG и `./deploy.sh vX.Y.Z` на сервере. Prerelease пропускается.

Настройки GitHub:

- Environment `production`: разрешены только теги `v*` (Deployment branches and tags → Selected branches and tags → Tags).
- Секреты environment: `PROD_SSH_KEY` — приватный ключ; `PROD_SSH_KNOWN_HOSTS` — строки `known_hosts` сервера; `PROD_SSH_DEST` — `ssh://user@host:port`.
- Пакеты `rpd-server` и `rpd-client` в GHCR — публичные.

Ключ Actions в `~/.ssh/authorized_keys` пользователя деплоя на сервере:

```text
restrict,command="~/rpd-app/rpd-constructor/deploy/deploy.sh \"$SSH_ORIGINAL_COMMAND\"" ssh-ed25519 … rpd-actions
```

Порядок выпуска — в [CONVENTIONS.md](docs/CONVENTIONS.md#версии-и-релизы), ручные шаги версий — в [CHANGELOG.md](CHANGELOG.md).
