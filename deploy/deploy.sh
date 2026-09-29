#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT="${COMPOSE_PROJECT_NAME:-rpd-server}"
DEPLOY_DIR="${RPD_DEPLOY_DIR:-$HOME/rpd-deploy}"
REMOTE="${RPD_GIT_REMOTE:-origin}"
KEEP_BACKUPS="${RPD_KEEP_BACKUPS:-10}"
WAIT_TIMEOUT="${RPD_WAIT_TIMEOUT:-180}"
RPD_HTTP_PORT="${RPD_HTTP_PORT:-8080}"
export RPD_HTTP_PORT
BACKUP_DIR="$DEPLOY_DIR/backups"
LOG_DIR="$DEPLOY_DIR/logs"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$LOG_DIR/deploy-$STAMP.log"
LOG_PIPE=""
CURRENT_TMP="$DEPLOY_DIR/.current.$$"
HISTORY_TMP="$DEPLOY_DIR/.history.$$"
LOCK_HELD=0
STOPPED=0
MIGRATION_STARTED=0
SERVER_RECREATE_ATTEMPTED=0
INIT=0
YES=0
TAG=""
PREV_REF=""
PREV_VERSION=""
DEPLOY_CONFIRMED=0
PREV_MIGRATIONS=""
BACKUP=""

# Все вызовы Compose закреплены за одним проектом и одним compose-файлом.
dc() {
  docker compose -p "$PROJECT" --project-directory "$SCRIPT_DIR" -f "$SCRIPT_DIR/compose.yaml" "$@"
}

cleanup() {
  if [[ -n "$LOG_PIPE" && -p "$LOG_PIPE" ]]; then
    rm "$LOG_PIPE"
  fi
  if (( LOCK_HELD )); then
    rmdir "$DEPLOY_DIR/lock" || true
  fi
  rm -f "$CURRENT_TMP" "$HISTORY_TMP"
}

fail() {
  echo "Ошибка: $*" >&2
  return 1
}

check_number() {
  [[ "$2" =~ ^[0-9]+$ ]] || fail "$1 должно быть целым неотрицательным числом"
}

# Проверка читает только наличие значения, не пишет секреты в журнал.
check_env_value() {
  local key="$1" line value=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*=(.*)$ ]]; then
      value="${BASH_REMATCH[1]}"
      value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      if [[ "$value" == \"*\" && "$value" == *\" ]] || [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
      fi
      break
    fi
  done < "$SCRIPT_DIR/.env"
  [[ -n "$value" ]] || fail "Задайте непустое $key в deploy/.env"
}

preflight() {
  local command_name dirty
  for command_name in git docker curl; do
    command -v "$command_name" >/dev/null || fail "Не найдена команда $command_name"
  done
  docker compose version --short >/dev/null || fail "Требуется Docker Compose v2 (docker compose)"
  [[ -f "$SCRIPT_DIR/.env" ]] || fail "Создайте deploy/.env по образцу deploy/.env.example"
  check_env_value DB_PASSWORD
  check_env_value ACCESS_TOKEN_SECRET
  check_env_value REFRESH_TOKEN_SECRET
  dirty="$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)"
  if [[ -n "$dirty" ]]; then
    echo "$dirty" >&2
    fail "Есть изменения в отслеживаемых файлах: перенесите правки прода в репозиторий или .env"
  fi
  if (( INIT )); then
    if docker volume inspect "${PROJECT}_postgres_data" >/dev/null 2>&1; then
      fail "С --init том ${PROJECT}_postgres_data должен отсутствовать"
    fi
  elif ! docker volume inspect "${PROJECT}_postgres_data" >/dev/null 2>&1; then
    fail "Том ${PROJECT}_postgres_data не найден; для первой установки укажите --init"
  fi
  # Compose должен разобрать .env и конфигурацию до остановки API.
  dc config --quiet || fail "Проверьте deploy/.env и deploy/compose.yaml"
}

package_version() {
  local ref="$1" path="$2"
  git -C "$REPO_DIR" show "$ref:$path" | sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

select_target() {
  local server_version client_version
  PREV_REF="$(git -C "$REPO_DIR" rev-parse HEAD)"
  PREV_VERSION="$(cat "$DEPLOY_DIR/current" 2>/dev/null || true)"
  git -C "$REPO_DIR" fetch --tags --prune "$REMOTE"
  if [[ -z "$TAG" ]]; then
    TAG="$(git -C "$REPO_DIR" for-each-ref --merged "$REMOTE/main" --sort=-version:refname --format='%(refname:short)' 'refs/tags/v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sed -n '1p' || true)"
  fi
  [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Тег должен иметь вид vX.Y.Z"
  git -C "$REPO_DIR" rev-parse -q --verify "refs/tags/$TAG^{commit}" >/dev/null || fail "Тег $TAG не найден"
  git -C "$REPO_DIR" merge-base --is-ancestor "refs/tags/$TAG^{commit}" "$REMOTE/main" || fail "Тег $TAG не входит в $REMOTE/main"
  server_version="$(package_version "$TAG" rpd-server/package.json)"
  client_version="$(package_version "$TAG" rpd-client-ts/package.json)"
  [[ "$server_version" == "${TAG#v}" && "$client_version" == "${TAG#v}" ]] || fail "Версии package.json не совпадают с $TAG"
  BACKUP="$BACKUP_DIR/rpd-${PREV_VERSION:-unknown}-to-$TAG-$STAMP.dump"
}

confirm_plan() {
  echo "Текущая версия: ${PREV_VERSION:-неизвестна — первая выкладка скриптом}"
  echo "Целевая версия: $TAG"
  if (( INIT )); then echo "Дамп: не требуется (--init)"; else echo "Дамп: $BACKUP"; fi
  if (( YES )); then return; fi
  [[ -t 0 ]] || fail "Без терминала требуется --yes"
  local answer
  read -r -p "Продолжить? [y/N] " answer
  [[ "$answer" == y || "$answer" == Y ]] || fail "Выкладка отменена"
}

db_sql() {
  dc exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1'
}

migration_journal() {
  local exists
  exists="$(printf "SELECT to_regclass('public.schema_migrations');\n" | db_sql)" || return 1
  if [[ -n "$exists" ]]; then
    printf 'SELECT name FROM schema_migrations ORDER BY name;\n' | db_sql
  fi
}

wait_health() {
  local expected="$1" deadline response version
  deadline=$((SECONDS + WAIT_TIMEOUT))
  while (( SECONDS <= deadline )); do
    response="$(curl -fsS --max-time 3 "http://127.0.0.1:$RPD_HTTP_PORT/api/health" 2>/dev/null || true)"
    version="$(printf '%s' "$response" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [[ "$version" == "${expected#v}" ]] && [[ "$response" == *'"status":"ok"'* ]]; then return 0; fi
    sleep 2
  done
  fail "Health через nginx клиента не подтвердил версию $expected за ${WAIT_TIMEOUT} с"
}

restore_db() {
  echo "Откат БД из $BACKUP"
  [[ -s "$BACKUP" ]] || { fail "Дамп отсутствует: $BACKUP"; return 1; }
  dc stop server || true
  # Имена БД и пользователя экранирует PostgreSQL через format(%I).
  dc exec -T db sh -c 'psql -X -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -v dbname="$POSTGRES_DB"' <<'SQL' || return 1
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'dbname') \gexec
SELECT format('CREATE DATABASE %I', :'dbname') \gexec
SQL
  dc exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' < "$BACKUP" || return 1
}

rollback() {
  local journal="" restore_needed=0 restore_ok=1
  echo "Начат откат после ошибки или прерывания."
  if (( ! INIT && MIGRATION_STARTED )); then
    if journal="$(migration_journal)"; then
      [[ "$journal" == "$PREV_MIGRATIONS" ]] || restore_needed=1
    else
      echo "Журнал миграций не читается; требуется восстановить дамп."
      restore_needed=1
    fi
    if (( restore_needed )); then
      if ! restore_db; then
        echo "ОШИБКА: восстановление БД не завершилось; используйте дамп $BACKUP вручную." >&2
        restore_ok=0
      fi
    else
      echo "Журнал миграций не изменился; БД сохранена."
    fi
  fi
  git -C "$REPO_DIR" checkout --quiet --detach "$PREV_REF" || echo "ОШИБКА: не удалось вернуть HEAD $PREV_REF" >&2
  if (( ! restore_ok )); then
    echo "Сервер оставлен остановленным, чтобы не работать с частично восстановленной БД. Лог: $LOG" >&2
    return
  fi
  if [[ -n "$PREV_VERSION" ]] && docker image inspect "rpd/server:$PREV_VERSION" "rpd/client:$PREV_VERSION" >/dev/null 2>&1; then
    RPD_VERSION="$PREV_VERSION" dc up -d --no-deps --wait --wait-timeout "$WAIT_TIMEOUT" server || echo "ОШИБКА: прежний сервер не запустился" >&2
    RPD_VERSION="$PREV_VERSION" dc up -d --no-deps --wait --wait-timeout "$WAIT_TIMEOUT" client || echo "ОШИБКА: прежний клиент не запустился" >&2
    wait_health "$PREV_VERSION" || echo "ОШИБКА: health прежней версии не подтвердился" >&2
  elif (( ! SERVER_RECREATE_ATTEMPTED )) && [[ -n "$(dc ps -aq server 2>/dev/null || true)" ]]; then
    dc start server || echo "ОШИБКА: прежний контейнер server не запустился" >&2
    echo "Прежний контейнер server запущен без пересоздания."
  elif (( ! INIT )); then
    echo "Прежние образы недоступны: поднимите 1.x из её каталога: cd ~/rpd-app/rpd-server && docker compose up -d"
    if (( restore_needed )); then echo "БД восстановлена из дампа $BACKUP."; else echo "БД не менялась."; fi
  else
    echo "Первая установка не завершилась; прежних контейнеров нет."
  fi
  echo "Откат завершён. Дамп: ${BACKUP:-нет}; лог: $LOG; current не изменён."
}

on_error() {
  local code="$1"
  trap - ERR INT TERM
  set +e
  if (( DEPLOY_CONFIRMED )); then
    echo "Версия $TAG выложена, но действия после проверки health прерваны (код $code). Лог: $LOG" >&2
    exit 0
  fi
  echo "Выкладка прервана (код $code)." >&2
  if (( STOPPED )); then rollback; else
    if [[ -n "$PREV_REF" ]]; then git -C "$REPO_DIR" checkout --quiet --detach "$PREV_REF" || true; fi
    echo "Прод не тронут. Лог: $LOG" >&2
  fi
  exit 1
}

on_signal() {
  echo "Получен сигнал $1" >&2
  on_error 1
}

prune_backups() {
  local count=0 file
  while IFS= read -r file; do
    count=$((count + 1))
    if (( count > KEEP_BACKUPS )); then rm "$file" || return 1; fi
  done < <(ls -1t "$BACKUP_DIR"/rpd-*.dump 2>/dev/null || true)
}

prune_images() {
  local repository image images failed=0
  for repository in rpd/server rpd/client; do
    images="$(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}')" || return 1
    while IFS= read -r image; do
      [[ "$image" == "$repository:"* ]] || continue
      [[ "$image" == "$repository:$TAG" || ( -n "$PREV_VERSION" && "$image" == "$repository:$PREV_VERSION" ) ]] && continue
      docker image rm "$image" || { echo "Не удалось удалить старый образ $image" >&2; failed=1; }
    done <<< "$images"
  done
  (( ! failed ))
}

record_current() {
  printf '%s\n' "$TAG" > "$CURRENT_TMP" || return 1
  mv "$CURRENT_TMP" "$DEPLOY_DIR/current"
}

record_history() {
  if [[ -f "$DEPLOY_DIR/history.log" ]]; then
    cat "$DEPLOY_DIR/history.log" > "$HISTORY_TMP" || return 1
  fi
  printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TAG" "${PREV_VERSION:-неизвестна}" "${BACKUP:-нет}" >> "$HISTORY_TMP" || return 1
  mv "$HISTORY_TMP" "$DEPLOY_DIR/history.log"
}

deploy() {
  local post_deploy_warning=0
  echo "Переключение исходников на $TAG"
  git -C "$REPO_DIR" -c advice.detachedHead=false checkout --quiet --detach "$TAG"
  echo "Сборка образов до остановки API"
  RPD_VERSION="$TAG" dc build || fail "Сборка не удалась; прод не тронут"
  if [[ -n "$(dc ps -aq server)" ]]; then
    dc stop server
  fi
  STOPPED=1
  echo "API остановлен; запуск PostgreSQL 17"
  dc up -d --wait --wait-timeout "$WAIT_TIMEOUT" db
  if (( ! INIT )); then
    echo "Создание дампа: $BACKUP"
    dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
    [[ -s "$BACKUP" ]] || fail "Дамп пустой"
    dc exec -T db pg_restore --list < "$BACKUP" >/dev/null || fail "Дамп не читается pg_restore"
    PREV_MIGRATIONS="$(migration_journal)" || fail "Не удалось прочитать журнал миграций"
  fi
  MIGRATION_STARTED=1
  RPD_VERSION="$TAG" dc run --rm --no-deps server bun run migrate
  SERVER_RECREATE_ATTEMPTED=1
  RPD_VERSION="$TAG" dc up -d --no-deps --wait --wait-timeout "$WAIT_TIMEOUT" server
  RPD_VERSION="$TAG" dc up -d --no-deps --wait --wait-timeout "$WAIT_TIMEOUT" client
  wait_health "$TAG"
  DEPLOY_CONFIRMED=1
  STOPPED=0
  if ! record_current; then
    echo "Предупреждение: не удалось обновить current" >&2
    post_deploy_warning=1
  fi
  if ! record_history; then
    echo "Предупреждение: не удалось обновить history.log" >&2
    post_deploy_warning=1
  fi
  if ! prune_backups; then
    echo "Предупреждение: не удалось удалить часть старых дампов" >&2
    post_deploy_warning=1
  fi
  if ! prune_images; then
    echo "Предупреждение: не удалось удалить часть старых образов" >&2
    post_deploy_warning=1
  fi
  if (( post_deploy_warning )); then
    echo "Версия $TAG выложена, но часть действий после проверки health завершилась с ошибкой. Дамп: ${BACKUP:-не требуется}. Лог: $LOG"
  else
    echo "Выложена версия $TAG. Дамп: ${BACKUP:-не требуется}. Лог: $LOG"
  fi
}

main() {
  local argument
  mkdir -p "$BACKUP_DIR" "$LOG_DIR"
  trap cleanup EXIT
  LOG_PIPE="$DEPLOY_DIR/log.pipe.$$"
  mkfifo "$LOG_PIPE"
  tee -a "$LOG" < "$LOG_PIPE" &
  exec > "$LOG_PIPE" 2>&1
  rm "$LOG_PIPE"
  trap 'on_error $?' ERR
  trap 'on_signal INT' INT
  trap 'on_signal TERM' TERM
  mkdir "$DEPLOY_DIR/lock" 2>/dev/null || fail "Выкладка уже идёт или прервалась — проверьте и удалите lock: $DEPLOY_DIR/lock"
  LOCK_HELD=1
  for argument in "$@"; do
    case "$argument" in
      --init) INIT=1 ;;
      --yes) YES=1 ;;
      v*) [[ -z "$TAG" ]] || fail "Укажите только один тег"; TAG="$argument" ;;
      *) fail "Неизвестный аргумент: $argument" ;;
    esac
  done
  check_number RPD_KEEP_BACKUPS "$KEEP_BACKUPS"
  check_number RPD_WAIT_TIMEOUT "$WAIT_TIMEOUT"
  (( WAIT_TIMEOUT > 0 )) || fail "RPD_WAIT_TIMEOUT должен быть больше нуля"
  preflight
  select_target
  confirm_plan
  deploy
}

# Скрипт переключает git на другой тег и тем самым переписывает себя на диске.
# Bash дочитывает файл по ходу выполнения; эта строка целиком разобрана до начала работы.
main "$@"; exit $?
