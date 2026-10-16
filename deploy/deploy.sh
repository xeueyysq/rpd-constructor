#!/usr/bin/env bash
set -euo pipefail

main() {
  [[ $# -eq 1 && ${1-} =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || { echo 'Укажите один тег vX.Y.Z без ведущих нулей' >&2; return 2; }
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
  export RPD_VERSION="$1"
  local server previous repository image
  server="$(docker compose ps -q server)"
  previous="$(docker inspect --format '{{.Config.Image}}' "$server" 2>/dev/null || true)"
  previous="${previous##*:}"
  git fetch --tags
  git checkout --detach "refs/tags/$RPD_VERSION"
  # Compose пересоздаёт приложение до ожидания depends_on: сначала проверяем миграции.
  docker compose up -d migrate
  [[ "$(docker wait "$(docker compose ps -aq migrate)")" == 0 ]] || { echo 'Миграции не выполнены; контейнеры приложения не обновлены' >&2; return 1; }
  # Зависимости уже завершены; не создаём второй дамп после миграций.
  docker compose up -d --wait --wait-timeout 180 --no-deps server client
  # При повторе тега сохраняем уже оставленную пару образов.
  [[ "$previous" != "$RPD_VERSION" ]] || return 0
  for repository in $(docker compose config --images | sed -n 's|^\(ghcr.io/[^/]*/rpd-[^:]*\):.*$|\1|p' | sort -u); do
    while IFS= read -r image; do
      [[ "$image" == "$repository:$RPD_VERSION" || "$image" == "$repository:$previous" ]] && continue
      docker image rm "$image" >/dev/null 2>&1 || true
    done < <(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}')
  done
}

# checkout переписывает этот файл; Bash должен разобрать вызов и exit заранее.
main "$@"; exit $?
