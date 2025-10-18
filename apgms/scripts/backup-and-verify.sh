#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL environment variable must be set" >&2
  exit 1
fi

start_time_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
start_ms=$(date +%s%3N)

tmpdir=$(mktemp -d)
trap_cleanup() {
  set +e
  if [[ -n "${TEMP_DB_NAME:-}" ]]; then
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TEMP_DB_NAME}\";" >/dev/null 2>&1
  fi
  rm -rf "${tmpdir}"
}
trap trap_cleanup EXIT

collect_row_counts() {
  local url="$1"
  local tables
  tables=$(psql "${url}" -At -F '|' -v ON_ERROR_STOP=1 <<'SQL'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
SQL
)

  if [[ -z "${tables}" ]]; then
    return 0
  fi

  while IFS='|' read -r schema table; do
    [[ -z "${schema}" ]] && continue
    local count
    count=$(psql "${url}" -At -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM \"${schema}\".\"${table}\";")
    printf '%s.%s\t%s\n' "${schema}" "${table}" "${count}"
  done <<< "${tables}"
}

dump_file="${tmpdir}/backup.dump"
pg_dump --format=custom --file="${dump_file}" "${DATABASE_URL}"

TEMP_DB_NAME="backup_verify_$(date +%s%N)"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TEMP_DB_NAME}\";" >/dev/null

TEMP_DATABASE_URL=$(python3 - "$DATABASE_URL" "$TEMP_DB_NAME" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit, quote

base_url = sys.argv[1]
new_db = sys.argv[2]
parts = urlsplit(base_url)
new_path = '/' + quote(new_db)
new_parts = parts._replace(path=new_path)
print(urlunsplit(new_parts))
PY
)

pg_restore --clean --if-exists --no-owner --dbname="${TEMP_DATABASE_URL}" "${dump_file}"

source_counts=$(collect_row_counts "${DATABASE_URL}" || true)
restored_counts=$(collect_row_counts "${TEMP_DATABASE_URL}" || true)

counts_for_report="${restored_counts:-$source_counts}"
row_counts_json="{}"
if [[ -n "${counts_for_report}" ]]; then
  row_counts_json=$(printf '%s\n' "${counts_for_report}" | python3 - <<'PY'
import sys, json
entries = {}
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    key, value = line.split('\t')
    entries[key] = int(value)
print(json.dumps(entries, separators=(',', ':')))
PY
)
fi

ok=true
if [[ "${source_counts}" != "${restored_counts}" ]]; then
  ok=false
fi

end_ms=$(date +%s%3N)
duration_ms=$((end_ms - start_ms))
finished_time_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

report_dir="/evidence/backup-restore"
mkdir -p "${report_dir}"
report_path="${report_dir}/${start_time_iso}.json"

cat <<REPORT > "${report_path}"
{
  "ok": ${ok},
  "rowCounts": ${row_counts_json},
  "duration_ms": ${duration_ms},
  "started_at": "${start_time_iso}",
  "finished_at": "${finished_time_iso}"
}
REPORT

echo "Backup verification report written to ${report_path}"

if [[ "${ok}" != "true" ]]; then
  echo "Row counts do not match between source and restored databases" >&2
  exit 1
fi
