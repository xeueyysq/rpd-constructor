#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source ./e2e.env
set +a
docker compose --env-file e2e.env down
docker compose --env-file e2e.env up -d --wait
(cd ../rpd-server && bun run migrate)
docker compose --env-file e2e.env exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < seed.sql
