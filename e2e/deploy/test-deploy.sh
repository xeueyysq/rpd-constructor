#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"
SRC="$T/src"
PROD="$T/prod"
PROJECT=rpd-deploy-test
SCENARIO="подготовка"

cleanup() {
  if [[ -f "$PROD/rpd-server/docker-compose.yml" && -f "$PROD/rpd-server/.env" ]]; then
    docker compose -p "$PROJECT" --project-directory "$PROD/rpd-server" -f "$PROD/rpd-server/docker-compose.yml" down -v --remove-orphans || true
  fi
  local repository image
  for repository in rpd/server rpd/client; do
    while IFS= read -r image; do
      [[ "$image" == "$repository:v9."* ]] && docker image rm "$image" >/dev/null 2>&1 || true
    done < <(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null || true)
  done
  rm -rf "$T"
}
trap cleanup EXIT
trap 'echo "FAIL: $SCENARIO" >&2' ERR

fail() {
  echo "Ошибка: $*" >&2
  return 1
}

dc() {
  docker compose -p "$PROJECT" --project-directory "$PROD/rpd-server" -f "$PROD/rpd-server/docker-compose.yml" "$@"
}

sql() {
  dc exec -T db psql -X -U postgres -d Rpd -tA -v ON_ERROR_STOP=1 -c "$1"
}

health_version() {
  curl -fsS http://127.0.0.1:18080/api/health | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

assert_equal() {
  [[ "$1" == "$2" ]] || fail "Ожидалось '$2', получено '$1': $3"
}

set_versions() {
  local version="$1"
  perl -pi -e 's/"version": "[^"]+"/"version": "'"$version"'"/' "$SRC/rpd-server/package.json" "$SRC/rpd-client-ts/package.json"
}

commit_tag() {
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
  git -C "$SRC" init -q -b main
  git -C "$SRC" config user.name "Тест выкладки"
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
  throw new Error("Проверка отката при ошибке миграции");
}
MIGRATION
  commit_tag v9.2.0

  set_versions 9.3.0
  rm "$SRC/rpd-server/app/migrations/versions/9002_deploy_fail.ts"
  cat > "$SRC/rpd-server/app/migrations/versions/9003_deploy_broken.ts" <<'MIGRATION'
import type { MigrationClient } from "../runner.ts";
export async function up(client: MigrationClient) {
  await client.query("CREATE TABLE deploy_broken (id INT)");
}
MIGRATION
  perl -pi -e 's/"start": "[^"]+"/"start": "node -e \\"process.exit(1)\\""/' "$SRC/rpd-server/package.json"
  commit_tag v9.3.0

  git clone -q --bare "$SRC" "$T/origin.git"
  git clone -q "$T/origin.git" "$PROD"
  cat > "$PROD/rpd-server/.env" <<'ENVFILE'
PORT=8000
CLIENT_URL=http://localhost:18080
API_URL=http://localhost:18080
ALLOWED_ORIGINS=http://localhost:18080
DB_HOST=db
DB_USER=postgres
DB_PASSWORD=deploy-test
DB_NAME=Rpd
DB_PORT=5432
ACCESS_TOKEN_SECRET=deploy-test-access-secret
REFRESH_TOKEN_SECRET=deploy-test-refresh-secret
ENVFILE
}

run_deploy() {
  (cd "$PROD/rpd-server" && ./deploy.sh "$@")
}

assert_marker() {
  assert_equal "$(sql 'SELECT count(*) FROM deploy_test WHERE id=42')" 1 "маркер в БД"
}

assert_rollback() {
  assert_equal "$(health_version)" 9.1.0 "версия после отката"
  assert_equal "$(cat "$T/state/current")" v9.1.0 "current после отката"
  assert_equal "$(git -C "$PROD" rev-parse HEAD)" "$(git -C "$PROD" rev-list -n 1 v9.1.0)" "HEAD после отката"
  assert_marker
}

command -v docker >/dev/null || fail "Для теста нужен Docker"
docker compose version >/dev/null || fail "Для теста нужен Docker Compose v2"
export COMPOSE_PROJECT_NAME="$PROJECT"
export RPD_HTTP_PORT=18080 RPD_API_PORT=18000 RPD_DEPLOY_DIR="$T/state" RPD_WAIT_TIMEOUT=180
prepare_repo

SCENARIO="1 — первая установка"
run_deploy v9.0.0 --init --yes
assert_equal "$(health_version)" 9.0.0 "первая версия"
assert_equal "$(cat "$T/state/current")" v9.0.0 "current"
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='0001_baseline'")" 1 "baseline"
echo "PASS: $SCENARIO"

SCENARIO="2 — миграция и дамп"
run_deploy v9.1.0 --yes
assert_equal "$(health_version)" 9.1.0 "вторая версия"
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9001_deploy_test'")" 1 "миграция 9001"
[[ -n "$(find "$T/state/backups" -name '*.dump' -type f -print -quit)" ]] || fail "Дамп не создан"
sql 'INSERT INTO deploy_test VALUES (42)' >/dev/null
echo "PASS: $SCENARIO"

SCENARIO="3 — ошибка миграции"
if run_deploy v9.2.0 --yes; then fail "Выкладка v9.2.0 должна завершиться ошибкой"; fi
assert_rollback
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9002_deploy_fail'")" 0 "журнал 9002"
assert_equal "$(sql "SELECT to_regclass('public.deploy_fail') IS NULL")" t "таблица deploy_fail"
echo "PASS: $SCENARIO"

SCENARIO="4 — ошибка старта сервера"
if run_deploy v9.3.0 --yes; then fail "Выкладка v9.3.0 должна завершиться ошибкой"; fi
assert_rollback
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9003_deploy_broken'")" 0 "журнал 9003"
assert_equal "$(sql "SELECT to_regclass('public.deploy_broken') IS NULL")" t "таблица deploy_broken"
echo "PASS: $SCENARIO"

SCENARIO="5 — грязное дерево"
printf '\n# Проверка грязного дерева\n' >> "$PROD/README.md"
if run_deploy v9.1.0 --yes; then fail "Выкладка с изменённым файлом должна быть отклонена"; fi
assert_equal "$(health_version)" 9.1.0 "версия после отказа"
git -C "$PROD" show HEAD:README.md > "$PROD/README.md"
echo "PASS: $SCENARIO"

SCENARIO="6 — повторная выкладка"
run_deploy v9.1.0 --yes
assert_equal "$(health_version)" 9.1.0 "версия при повторе"
assert_equal "$(sql "SELECT count(*) FROM schema_migrations WHERE name='9001_deploy_test'")" 1 "повтор миграции"
echo "PASS: $SCENARIO"
