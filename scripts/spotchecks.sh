#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
TMPDIR=$(mktemp -d -t spotchecks.XXXXXX)

BASE_URL=${BASE_URL:-http://localhost:8080}
HEALTHZ_PATH=${HEALTHZ_PATH:-/healthz}
READYZ_PATH=${READYZ_PATH:-/readyz}
PAYTO_ENDPOINT=${PAYTO_ENDPOINT:-/webhooks/payto}
AUDIT_RPT_ENDPOINT_BASE=${AUDIT_RPT_ENDPOINT_BASE:-/audit/rpt}
DB_SERVICE=${DB_SERVICE:-postgres}
COMPOSE_FILE=${COMPOSE_FILE:-${REPO_ROOT}/apgms/docker-compose.yml}
DB_DOWN_CMD=${DB_DOWN_CMD:-}
DB_UP_CMD=${DB_UP_CMD:-}
PAYTO_SECRET=${PAYTO_SECRET:-${PAYTO_WEBHOOK_SECRET:-}}
RPT_ID=${RPT_ID:-}
RPT_TAMPER_CMD=${RPT_TAMPER_CMD:-}

LAST_BODY=""
LAST_HEADERS=""
LAST_STATUS=""
DB_SHOULD_RESTORE=0
COMPOSE_CMD=()

cleanup() {
  local exit_code=$1
  if [[ ${DB_SHOULD_RESTORE} -eq 1 ]]; then
    if ! bring_db_up_cmd; then
      echo "WARN: failed to restart database service" >&2
    fi
  fi
  rm -rf "${TMPDIR}"
  exit "${exit_code}"
}

trap 'cleanup $?' EXIT

fail() {
  local message=$1
  echo "FAIL ${message}"
  exit 1
}

pass() {
  local message=$1
  echo "PASS ${message}"
}

uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen
  else
    openssl rand -hex 16
  fi
}

init_compose_cmd() {
  if [[ -n ${DB_DOWN_CMD} && -n ${DB_UP_CMD} ]]; then
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      COMPOSE_CMD=(docker compose)
      return
    fi
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    if docker-compose version >/dev/null 2>&1; then
      COMPOSE_CMD=(docker-compose)
      return
    fi
  fi
}

http_request() {
  local method=$1
  local path=$2
  shift 2

  LAST_BODY="${TMPDIR}/body-$(uuid)"
  LAST_HEADERS="${TMPDIR}/headers-$(uuid)"

  local url
  if [[ ${path} == http* ]]; then
    url=${path}
  else
    if [[ ${path} != /* ]]; then
      path="/${path}"
    fi
    url="${BASE_URL%/}${path}"
  fi

  local status
  if ! status=$(curl -sS -X "${method}" "${url}" -o "${LAST_BODY}" -D "${LAST_HEADERS}" -w '%{http_code}' "$@" 2>"${TMPDIR}/curl.err"); then
    local err_msg
    err_msg=$(cat "${TMPDIR}/curl.err")
    fail "${method} ${path} request failed: ${err_msg}"
  fi
  LAST_STATUS=${status}
}

wait_for_status() {
  local method=$1
  local path=$2
  local expected=$3
  local attempts=${4:-10}
  local interval=${5:-1}
  shift 5 || true

  local i
  for ((i = 1; i <= attempts; i++)); do
    http_request "${method}" "${path}" "$@"
    if [[ ${LAST_STATUS} == "${expected}" ]]; then
      return 0
    fi
    sleep "${interval}"
  done
  fail "${method} ${path} expected status ${expected} after ${attempts} attempts, last status ${LAST_STATUS}. Response: $(<"${LAST_BODY}")"
}

timestamp_seconds() {
  local delta_minutes=$1
  python3 - "$delta_minutes" <<'PY'
import sys
from datetime import datetime, timezone, timedelta
minutes = int(sys.argv[1])
now = datetime.now(timezone.utc) + timedelta(minutes=minutes)
print(int(now.timestamp()))
PY
}

compute_payto_signature() {
  local timestamp=$1
  local payload=$2
  if [[ -z ${PAYTO_SECRET} ]]; then
    fail "PAYTO_SECRET (or PAYTO_WEBHOOK_SECRET) must be set to compute webhook signatures"
  fi
  printf '%s' "${timestamp}.${payload}" |
    openssl dgst -sha256 -hmac "${PAYTO_SECRET}" -binary |
    xxd -p -c 256
}

bring_db_down_cmd() {
  if [[ -n ${DB_DOWN_CMD} ]]; then
    eval "${DB_DOWN_CMD}"
    return $?
  fi
  if [[ ${#COMPOSE_CMD[@]} -eq 0 ]]; then
    init_compose_cmd
  fi
  if [[ ${#COMPOSE_CMD[@]} -eq 0 ]]; then
    echo "Set DB_DOWN_CMD to simulate database outage" >&2
    return 1
  fi
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" stop "${DB_SERVICE}"
}

bring_db_up_cmd() {
  if [[ ${DB_SHOULD_RESTORE} -eq 0 ]]; then
    return 0
  fi
  if [[ -n ${DB_UP_CMD} ]]; then
    eval "${DB_UP_CMD}"
    return $?
  fi
  if [[ ${#COMPOSE_CMD[@]} -eq 0 ]]; then
    init_compose_cmd
  fi
  if [[ ${#COMPOSE_CMD[@]} -eq 0 ]]; then
    echo "Set DB_UP_CMD to restart database service" >&2
    return 1
  fi
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" start "${DB_SERVICE}"
}

simulate_db_down() {
  if [[ ${DB_SHOULD_RESTORE} -eq 1 ]]; then
    return 0
  fi
  if ! bring_db_down_cmd; then
    fail "Unable to stop database service for readiness check"
  fi
  DB_SHOULD_RESTORE=1
}

restore_db() {
  if [[ ${DB_SHOULD_RESTORE} -eq 0 ]]; then
    return 0
  fi
  if ! bring_db_up_cmd; then
    return 1
  fi
  DB_SHOULD_RESTORE=0
  return 0
}

check_healthz() {
  http_request GET "${HEALTHZ_PATH}"
  if [[ ${LAST_STATUS} != "200" ]]; then
    fail "GET ${HEALTHZ_PATH} expected 200, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  pass "GET ${HEALTHZ_PATH} returned 200"
}

check_readyz_with_db_up() {
  http_request GET "${READYZ_PATH}"
  if [[ ${LAST_STATUS} != "200" ]]; then
    fail "GET ${READYZ_PATH} expected 200 while DB up, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  pass "GET ${READYZ_PATH} returned 200 with database up"
}

check_readyz_with_db_down() {
  simulate_db_down
  wait_for_status GET "${READYZ_PATH}" 503 10 1
  if ! grep -qi 'reason' "${LAST_BODY}"; then
    fail "GET ${READYZ_PATH} while DB down missing failure reason. Body: $(<"${LAST_BODY}")"
  fi
  pass "GET ${READYZ_PATH} returned 503 with reason while database down"
  if ! restore_db; then
    fail "Database failed to restart after outage simulation"
  fi
  wait_for_status GET "${READYZ_PATH}" 200 30 2
  pass "GET ${READYZ_PATH} returned 200 after database recovery"
}

check_bank_lines_idempotency() {
  local key="spotcheck-$(uuid)"
  local payload_file="${TMPDIR}/bank-lines.json"
  cat > "${payload_file}" <<'JSON'
{
  "orgId": "spotcheck",
  "date": "2024-01-01T00:00:00Z",
  "amount": 123.45,
  "payee": "Spot Check",
  "desc": "Manual verification"
}
JSON
  http_request POST /bank-lines \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: ${key}" \
    --data-binary @"${payload_file}"
  if [[ ${LAST_STATUS} != "200" && ${LAST_STATUS} != "201" ]]; then
    fail "POST /bank-lines first call expected 200 or 201, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  local first_body="${TMPDIR}/bank-lines-first.json"
  cp "${LAST_BODY}" "${first_body}"
  http_request POST /bank-lines \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: ${key}" \
    --data-binary @"${payload_file}"
  if [[ ${LAST_STATUS} != "200" ]]; then
    fail "POST /bank-lines idempotent replay expected 200, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  if ! cmp -s "${first_body}" "${LAST_BODY}"; then
    fail "POST /bank-lines idempotent replay response differed from cached response"
  fi
  pass "POST /bank-lines idempotent replay returned cached response"
}

check_payto_webhook() {
  local payload='{"event":"payto.payout","data":{"id":"spotcheck","amount":100}}'
  local stale_ts
  stale_ts=$(timestamp_seconds -180)
  local signature
  signature=$(compute_payto_signature "${stale_ts}" "${payload}")
  http_request POST "${PAYTO_ENDPOINT}" \
    -H 'Content-Type: application/json' \
    -H "X-PayTo-Timestamp: ${stale_ts}" \
    -H "X-PayTo-Signature: sha256=${signature}" \
    --data "${payload}"
  if [[ ${LAST_STATUS} != "409" ]]; then
    fail "POST ${PAYTO_ENDPOINT} with stale timestamp expected 409, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  if ! grep -qi 'stale' "${LAST_BODY}" && ! grep -qi 'timestamp' "${LAST_BODY}"; then
    fail "POST ${PAYTO_ENDPOINT} with stale timestamp missing descriptive reason. Body: $(<"${LAST_BODY}")"
  fi
  pass "POST ${PAYTO_ENDPOINT} with stale timestamp returned 409"

  local fresh_ts
  fresh_ts=$(timestamp_seconds 0)
  http_request POST "${PAYTO_ENDPOINT}" \
    -H 'Content-Type: application/json' \
    -H "X-PayTo-Timestamp: ${fresh_ts}" \
    -H 'X-PayTo-Signature: sha256=deadbeef' \
    --data "${payload}"
  if [[ ${LAST_STATUS} != "401" ]]; then
    fail "POST ${PAYTO_ENDPOINT} with bad HMAC expected 401, got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
  fi
  if ! grep -qi 'signature' "${LAST_BODY}" && ! grep -qi 'unauthor' "${LAST_BODY}"; then
    fail "POST ${PAYTO_ENDPOINT} with bad HMAC missing verification message. Body: $(<"${LAST_BODY}")"
  fi
  pass "POST ${PAYTO_ENDPOINT} with bad HMAC returned 401"
}

check_audit_rpt_tamper() {
  if [[ -z ${RPT_ID} ]]; then
    fail "RPT_ID must be provided via environment for audit tamper check"
  fi
  if [[ -z ${RPT_TAMPER_CMD} ]]; then
    fail "RPT_TAMPER_CMD must point to a script/command that corrupts the stored RPT"
  fi
  if ! "${RPT_TAMPER_CMD}" "${RPT_ID}"; then
    fail "RPT_TAMPER_CMD failed for RPT_ID=${RPT_ID}"
  fi
  http_request GET "${AUDIT_RPT_ENDPOINT_BASE}/${RPT_ID}"
  case ${LAST_STATUS} in
    409|422|400)
      :
      ;;
    *)
      fail "GET ${AUDIT_RPT_ENDPOINT_BASE}/${RPT_ID} expected verification failure status (409/422/400), got ${LAST_STATUS}. Body: $(<"${LAST_BODY}")"
      ;;
  esac
  if ! grep -qi 'verify' "${LAST_BODY}" && ! grep -qi 'signature' "${LAST_BODY}"; then
    fail "GET ${AUDIT_RPT_ENDPOINT_BASE}/${RPT_ID} did not report verification failure. Body: $(<"${LAST_BODY}")"
  fi
  pass "GET ${AUDIT_RPT_ENDPOINT_BASE}/${RPT_ID} shows verification failure after tampering"
}

check_healthz
check_readyz_with_db_up
check_readyz_with_db_down
check_bank_lines_idempotency
check_payto_webhook
check_audit_rpt_tamper
