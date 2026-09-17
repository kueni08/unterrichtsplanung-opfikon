#!/usr/bin/env bash
# Startet eine temporäre PostgreSQL-Instanz, spielt die Migration ein und führt die RLS-Tests aus.
# Voraussetzung: PostgreSQL 15+ (initdb, pg_ctl, psql) im PATH oder unter /usr/lib/postgresql/*/bin.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pgbin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="${pgbin:+$pgbin:}$PATH"
data="$(mktemp -d)"
port="${PGTEST_PORT:-55432}"
cleanup() { pg_ctl -D "$data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$data"; }
trap cleanup EXIT
initdb -D "$data" -U postgres -A trust >/dev/null
pg_ctl -D "$data" -o "-p $port -k $data -c wal_level=logical" -l "$data/log" start >/dev/null
psql_run() { psql -X -v ON_ERROR_STOP=1 -q -t -o /dev/null -h "$data" -p "$port" -U postgres -d postgres "$@"; }
psql_run -f "$here/local-auth-stub.sql"
for f in "$here"/../migrations/*.sql; do psql_run -f "$f"; done
psql_run -f "$here/rls.test.sql"
