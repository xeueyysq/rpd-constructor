#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
command -v docker >/dev/null || { echo 'Для теста нужен Docker' >&2; exit 1; }
docker compose version
docker info >/dev/null
T="$(mktemp -d)"
T="$(cd "$T" && pwd -P)"
SRC="$T/src"
PROD="$T/prod"
PROJECT="rpd-deploy-test-$$"
REGISTRY="ghcr.io/$PROJECT"
SCENARIO="подготовка"
export COMPOSE_PROJECT_NAME="$PROJECT" RPD_BACKUP_DIR="$T/backups" RPD_VERSION=v9.0.0
export RPD_HTTP_PORT="${RPD_HTTP_PORT:-18080}" RPD_API_PORT="${RPD_API_PORT:-18000}"
export COMPOSE_FILE="$PROD/deploy/compose.yaml:$T/compose.test.yaml"

dc() {
  (cd "$PROD/deploy" && docker compose "$@")
}

cleanup() {
  if [[ -f "$PROD/deploy/.env" && -f "$T/compose.test.yaml" ]]; then
    dc down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  local image
  while IFS= read -r image; do
    [[ -z "$image" ]] || docker image rm -f "$image" >/dev/null 2>&1 || true
  done < <(docker image ls --filter "label=io.rpd.deploy-test=$PROJECT" --format '{{.ID}}' | sort -u)
  rm -rf "$T"
}
trap cleanup EXIT
trap 'echo "FAIL: $SCENARIO" >&2' ERR

fail() {
  echo "Ошибка: $*" >&2
  return 1
}

assert_equal() {
  [[ "$1" == "$2" ]] || fail "Ожидалось '$2', получено '$1': $3"
}

sql() {
  dc exec -T db psql -X -U postgres -d Rpd -tA -v ON_ERROR_STOP=1 -c "$1"
}

health_version() {
  curl -fsS --max-time 3 "http://127.0.0.1:$1/api/health" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

assert_health() {
  local expected="$1" attempt
  for attempt in {1..30}; do
    if [[ "$(health_version "$RPD_HTTP_PORT" 2>/dev/null || true)" == "$expected" && "$(health_version "$RPD_API_PORT" 2>/dev/null || true)" == "$expected" ]]; then return; fi
    sleep 1
  done
  fail "HTTP/API не подтвердили версию $expected"
}

assert_marker() {
  assert_equal "$(sql 'SELECT count(*) FROM deploy_marker WHERE id=42')" 1 'маркер в БД'
}

assert_private_log() {
  if grep -q DEPLOY_PRIVATE_LOG "$T/deploy.log"; then fail 'Вывод контейнера попал в журнал выкладки'; fi
}

set_versions() {
  perl -pi -e 's/"version": "[^"]+"/"version": "'"$1"'"/' "$SRC/rpd-server/package.json" "$SRC/rpd-client-ts/package.json"
}

commit_tag() {
  # Все записи Git выполняются только в одноразовом тестовом репозитории.
  git -C "$SRC" add -A
  git -C "$SRC" commit -qm "$1"
  git -C "$SRC" tag "$1"
}

prepare_repo() {
  local file
  mkdir -p "$SRC"
  while IFS= read -r -d '' file; do
    [[ -e "$ROOT/$file" || -L "$ROOT/$file" ]] || continue
    mkdir -p "$SRC/$(dirname "$file")"
    cp -Pp "$ROOT/$file" "$SRC/$file"
  done < <(git -C "$ROOT" ls-files -co --exclude-standard -z)
  perl -pi -e 's|ghcr.io/xeueyysq/|ghcr.io/'"$PROJECT"'/|g' "$SRC/deploy/compose.yaml"
  git -C "$SRC" init -q -b main
  git -C "$SRC" config user.name 'Тест выкладки'
  git -C "$SRC" config user.email deploy-test@example.invalid
  set_versions 9.0.0
  commit_tag v9.0.0

  set_versions 9.1.0
  cat > "$SRC/rpd-server/app/migrations/versions/9001_deploy_test.ts" <<'MIGRATION'
import type { MigrationClient } from "../runner.ts";
export async function up(client: MigrationClient) {
  await client.query("CREATE TABLE deploy_test (id INT)");
}
MIGRATION
  commit_tag v9.1.0

  set_versions 9.2.0
  cat > "$SRC/rpd-server/app/migrations/versions/9002_deploy_fail.ts" <<'MIGRATION'
import type { MigrationClient } from "../runner.ts";
export async function up(client: MigrationClient) {
  await client.query("CREATE TABLE deploy_fail (id INT)");
  throw new Error("DEPLOY_PRIVATE_LOG: ошибка миграции");
}
MIGRATION
  commit_tag v9.2.0

  set_versions 9.3.0
  rm "$SRC/rpd-server/app/migrations/versions/9002_deploy_fail.ts"
  # Схема не меняется: проверяем именно откат образов командой из README.
  cat >> "$SRC/rpd-server/Dockerfile" <<'DOCKERFILE'

CMD ["node", "-e", "console.error('DEPLOY_PRIVATE_LOG: ошибка старта'); process.exit(1)"]
DOCKERFILE
  commit_tag v9.3.0

  git clone -q --bare "$SRC" "$T/origin.git"
  git clone -q "$T/origin.git" "$PROD"
  cat > "$PROD/deploy/.env" <<ENVFILE
PORT=8000
CLIENT_URL=http://localhost:$RPD_HTTP_PORT
API_URL=http://localhost:$RPD_HTTP_PORT
ALLOWED_ORIGINS=http://localhost:$RPD_HTTP_PORT
DB_HOST=db
DB_USER=postgres
DB_PASSWORD=deploy-test
DB_NAME=Rpd
DB_PORT=5432
ACCESS_TOKEN_SECRET=deploy-test-access-secret
REFRESH_TOKEN_SECRET=deploy-test-refresh-secret
ENVFILE
  cat > "$T/compose.test.yaml" <<'COMPOSE'
services:
  server:
    restart: "no"
    healthcheck:
      interval: 1s
      timeout: 1s
      retries: 5
      start_period: 5s
COMPOSE
}

build_tag() {
  local tag="$1"
  git -C "$SRC" checkout -q --detach "$tag"
  docker build --label "io.rpd.deploy-test=$PROJECT" -t "$REGISTRY/rpd-server:$tag" "$SRC/rpd-server"
  docker build --label "io.rpd.deploy-test=$PROJECT" -t "$REGISTRY/rpd-client:$tag" "$SRC/rpd-client-ts"
}

run_deploy() {
  local result=0
  (cd "$PROD/deploy" && ./deploy.sh "$@") > "$T/deploy.log" 2>&1 || result=$?
  cat "$T/deploy.log"
  return "$result"
}

snapshot() {
  git -C "$PROD" rev-parse HEAD
  dc ps -aq | sort
  sql "SELECT name || ':' || checksum || ':' || applied_at FROM schema_migrations ORDER BY name"
  find "$RPD_BACKUP_DIR" -type f | sort
  docker image ls --filter "label=io.rpd.deploy-test=$PROJECT" --format '{{.Repository}}:{{.Tag}} {{.ID}}' | sort
}

prepare_repo

SCENARIO='1 — первая установка на пустой том'
build_tag v9.0.0
if docker volume inspect "${PROJECT}_postgres_data" >/dev/null 2>&1; then fail 'Тестовый том уже существует'; fi
run_deploy v9.0.0
assert_private_log
assert_health 9.0.0
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='0001_baseline'")" 1 baseline
mjs="$(dc exec -T client sh -c 'cd /usr/share/nginx/html && ls assets/*.mjs | head -n 1')"
[[ -n "$mjs" ]] || fail 'В сборке клиента нет .mjs (воркер pdf.js)'
assert_equal "$(curl -fsS -o /dev/null -w '%{content_type}' "http://127.0.0.1:$RPD_HTTP_PORT/$mjs")" application/javascript "тип $mjs"
sql 'CREATE TABLE deploy_marker (id INT); INSERT INTO deploy_marker VALUES (42)' >/dev/null
echo "PASS: $SCENARIO"

SCENARIO='2 — обновление с миграцией и дампом'
# Старые дампы и лишние теги проверяют обе политики очистки.
for number in {1..11}; do
  printf 'old' > "$RPD_BACKUP_DIR/rpd-retention-$number.dump"
  touch -t 200001010000 "$RPD_BACKUP_DIR/rpd-retention-$number.dump"
done
for service in server client; do docker tag "$REGISTRY/rpd-$service:v9.0.0" "$REGISTRY/rpd-$service:v8.0.0"; done
build_tag v9.1.0
run_deploy v9.1.0
assert_private_log
assert_health 9.1.0
assert_marker
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9001_deploy_test'")" 1 'миграция 9001'
assert_equal "$(find "$RPD_BACKUP_DIR" -name '*.dump' -type f | wc -l | tr -d ' ')" 10 'последние 10 дампов'
backup="$(find "$RPD_BACKUP_DIR" -name 'rpd-v9.1.0-*.dump' -type f | sort | head -n 1)"
[[ -s "$backup" ]] || fail 'Дамп перед обновлением не создан'
dc exec -T db createdb -U postgres deploy_restore_test
dc exec -T db pg_restore -U postgres -d deploy_restore_test --exit-on-error < "$backup"
assert_equal "$(dc exec -T db psql -X -U postgres -d deploy_restore_test -tA -c 'SELECT count(*) FROM deploy_marker WHERE id=42')" 1 'данные в дампе'
assert_equal "$(dc exec -T db psql -X -U postgres -d deploy_restore_test -tA -c "SELECT to_regclass('public.deploy_test') IS NULL")" t 'дамп создан до миграции'
dc exec -T db dropdb -U postgres deploy_restore_test
for service in server client; do
  docker image inspect "$REGISTRY/rpd-$service:v9.0.0" "$REGISTRY/rpd-$service:v9.1.0" >/dev/null
  if docker image inspect "$REGISTRY/rpd-$service:v8.0.0" >/dev/null 2>&1; then fail "Старый тег rpd-$service не удалён"; fi
done
echo "PASS: $SCENARIO"

SCENARIO='3 — ошибка миграции оставляет прежнее приложение'
build_tag v9.2.0
server_before="$(dc ps -q server)"
client_before="$(dc ps -q client)"
if run_deploy v9.2.0; then fail 'Выкладка v9.2.0 должна завершиться ошибкой'; fi
assert_private_log
assert_equal "$(dc ps -q server)" "$server_before" 'прежний контейнер сервера'
assert_equal "$(dc ps -q client)" "$client_before" 'прежний контейнер клиента'
assert_health 9.1.0
assert_marker
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9002_deploy_fail'")" 0 'журнал 9002'
assert_equal "$(sql "SELECT to_regclass('public.deploy_fail') IS NULL")" t 'таблица deploy_fail'
echo "PASS: $SCENARIO"

SCENARIO='4 — ошибка старта сервера и ручной откат'
build_tag v9.3.0
if run_deploy v9.3.0; then fail 'Выкладка v9.3.0 должна завершиться ошибкой'; fi
assert_private_log
RPD_VERSION=v9.1.0 dc up -d --wait
assert_health 9.1.0
assert_marker
echo "PASS: $SCENARIO"

SCENARIO='5 — forced command отклоняет невалидные теги без изменений'
before="$(snapshot)"
for invalid in '' HEAD --help v1.2 v01.2.3 v1.02.3 v1.2.03 v1.2.3-rc.1 v1.2.3+build 'v9.1.0 --yes' "v9.1.0; touch $T/injected" "\$(touch $T/injected)" $'v9.1.0\n'; do
  if SSH_ORIGINAL_COMMAND="$invalid" sh -c 'exec "$1" "$SSH_ORIGINAL_COMMAND"' sh "$PROD/deploy/deploy.sh" > "$T/forced.log" 2>&1; then
    fail "Forced command принял невалидный тег: $invalid"
  fi
done
[[ ! -e "$T/injected" ]] || fail 'Выполнена команда из аргумента SSH'
assert_equal "$(snapshot)" "$before" 'состояние после невалидных тегов'
assert_health 9.1.0
assert_marker
echo "PASS: $SCENARIO"

SCENARIO='6 — повтор того же тега'
journal="$(sql 'SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name')"
run_deploy v9.1.0
assert_private_log
assert_health 9.1.0
assert_equal "$(sql 'SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name')" "$journal" 'миграции не применены повторно'
assert_marker
echo "PASS: $SCENARIO"
