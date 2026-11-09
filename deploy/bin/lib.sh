#!/usr/bin/env bash
# Shared helpers for the deploy/bin scripts. Sourced, not run.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
CHURCHES_DIR="$DEPLOY_DIR/churches"
GENERATED_DIR="$DEPLOY_DIR/generated"
BACKUP_DIR="$DEPLOY_DIR/backups"

if [ -f "$DEPLOY_DIR/.env" ]; then
  set -a; . "$DEPLOY_DIR/.env"; set +a
fi
RELEASE="${RELEASE:-latest}"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

compose() {
  local files=(-f "$DEPLOY_DIR/docker-compose.yml")
  [ -f "$GENERATED_DIR/docker-compose.churches.yml" ] && files+=(-f "$GENERATED_DIR/docker-compose.churches.yml")
  docker compose --project-directory "$DEPLOY_DIR" --env-file "$DEPLOY_DIR/.env" "${files[@]}" "$@"
}

valid_slug() { [[ "$1" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; }

church_slugs() {
  [ -d "$CHURCHES_DIR" ] || return 0
  for f in "$CHURCHES_DIR"/*/church.env; do
    [ -f "$f" ] && basename "$(dirname "$f")"
  done
}

# Read one KEY from a church's settings file (no shell evaluation).
church_var() {
  local slug="$1" key="$2"
  grep -E "^${key}=" "$CHURCHES_DIR/$slug/church.env" | tail -1 | cut -d= -f2-
}

db_name() { echo "sc_${1//-/_}"; }

wait_healthy() {
  local service="$1" tries=60
  while [ $tries -gt 0 ]; do
    local id; id="$(compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$id" ]; then
      local state; state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
      [ "$state" = "healthy" ] && return 0
    fi
    sleep 3; tries=$((tries - 1))
  done
  return 1
}

# Run drizzle schema push for one church inside the tools image.
schema_push() {
  local slug="$1" mode="${2:-push}"
  local network; network="$(compose ps -q postgres | xargs docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | tr ' ' '\n' | grep internal | head -1)"
  [ -n "$network" ] || die "postgres is not running"
  local tty=(-i); [ -t 0 ] && [ -t 1 ] && tty=(-it)
  docker run --rm "${tty[@]}" --network "$network" \
    -e DATABASE_URL="$(church_var "$slug" DATABASE_URL)" \
    "shepherd-connect-tools:$RELEASE" \
    pnpm --filter @workspace/db run "$mode"
}
