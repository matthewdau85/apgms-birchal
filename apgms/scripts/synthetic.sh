#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${1:-${BASE_URL:-"https://gateway.prod.example.com"}}
AUTH_HEADER=${2:-${AUTH_HEADER:-""}}
READYZ_MAX=${READYZ_MAX:-0.20}   # seconds
BANK_LINES_MAX=${BANK_LINES_MAX:-0.45} # seconds
LOG_DIR=${LOG_DIR:-artifacts}
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
LOG_FILE="${LOG_DIR}/synthetic-${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"

log() {
  printf '%s %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$1" | tee -a "${LOG_FILE}"
}

curl_check() {
  local path=$1
  local threshold=$2
  local header_flag=()
  if [[ -n "${AUTH_HEADER}" ]]; then
    header_flag=(-H "${AUTH_HEADER}")
  fi

  local url="${BASE_URL%/}${path}"
  local output
  if ! output=$(curl -sS -o /tmp/synthetic_body.$$ -w '%{http_code} %{time_total}' "${header_flag[@]}" "$url"); then
    log "ERROR ${path} curl_failed"
    rm -f /tmp/synthetic_body.$$
    return 1
  fi
  rm -f /tmp/synthetic_body.$$

  local status duration
  read -r status duration <<<"${output}"
  log "INFO ${path} status=${status} duration=${duration}s threshold=${threshold}s"
  if [[ $status != 2* && $status != 3* ]]; then
    log "ERROR ${path} unexpected_status=${status}"
    return 1
  fi
  if ! awk -v d="${duration}" -v t="${threshold}" 'BEGIN {exit (d<=t ? 0 : 1)}'; then
    log "ERROR ${path} latency_breach duration=${duration}s threshold=${threshold}s"
    return 1
  fi
  return 0
}

log "INFO synthetic_start base_url=${BASE_URL}"
status=0

if ! curl_check "/readyz" "${READYZ_MAX}"; then
  status=1
fi

if ! curl_check "/bank-lines" "${BANK_LINES_MAX}"; then
  status=1
fi

if [[ ${status} -eq 0 ]]; then
  log "INFO synthetic_success"
else
  log "ERROR synthetic_failure"
fi

exit ${status}
