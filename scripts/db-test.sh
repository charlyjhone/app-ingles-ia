#!/usr/bin/env bash
# Cria um banco descartável, aplica TODAS as migrações em ordem e roda os
# testes de segurança. Usado localmente e no CI.
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm db:test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
TEST_DB="app_test_$(date +%s)"
TEST_URL="${ADMIN_URL%/*}/${TEST_DB}"

psql "$ADMIN_URL" -qc "create database ${TEST_DB}"
trap 'psql "$ADMIN_URL" -qc "drop database if exists ${TEST_DB}" >/dev/null' EXIT

psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ aplicando $(basename "$f")"
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "→ testando $(basename "$f")"
  psql "$TEST_URL" -q -o /dev/null -v ON_ERROR_STOP=1 -f "$f" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /   /'
  test "${PIPESTATUS[0]}" -eq 0
done
