#!/usr/bin/env bash
# Export the Replit database to a single file. Run INSIDE the Replit Shell:
#   bash deploy/migrate-from-replit/export-db.sh
# Then download shepherd-replit.dump (Files panel → right-click → Download)
# and copy it to the server.
set -euo pipefail
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set in this Repl" >&2; exit 1; }
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file shepherd-replit.dump
ls -lh shepherd-replit.dump
echo "Exported. Download shepherd-replit.dump and delete it from the Repl afterwards (it contains personal data)."
