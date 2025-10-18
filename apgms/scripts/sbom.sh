#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="${WORKSPACE_DIR:-}"

if [[ -z "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${ROOT_DIR}/package.json" || -f "${ROOT_DIR}/pnpm-workspace.yaml" ]]; then
    WORKSPACE_DIR="$ROOT_DIR"
  elif [[ -d "${ROOT_DIR}/apgms" && -f "${ROOT_DIR}/apgms/pnpm-workspace.yaml" ]]; then
    WORKSPACE_DIR="${ROOT_DIR}/apgms"
  else
    echo "Unable to locate Node workspace. Set WORKSPACE_DIR." >&2
    exit 1
  fi
else
  if [[ ! -d "${WORKSPACE_DIR}" ]]; then
    echo "WORKSPACE_DIR '${WORKSPACE_DIR}' does not exist" >&2
    exit 1
  fi
fi

SBOM_PATH="${SBOM_PATH:-${ROOT_DIR}/sbom.json}"
ALLOWED_FILE="${ALLOWED_VULNERABILITIES_FILE:-${ROOT_DIR}/scripts/sbom-allowlist.txt}"

mapfile -t ALLOWED_IDS < <(
  if [[ -f "${ALLOWED_FILE}" ]]; then
    grep -vE '^\s*(#|$)' "${ALLOWED_FILE}" | tr -d '\r' || true
  fi
)

is_allowed() {
  local needle="${1}"
  if [[ -z "${needle}" ]]; then
    return 1
  fi
  for allow in "${ALLOWED_IDS[@]}"; do
    if [[ "${needle}" == *"${allow}"* ]]; then
      return 0
    fi
  done
  return 1
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required tool '$1' not found" >&2
    exit 1
  fi
}

run_audit() {
  local tool="$1"
  local cmd=()
  local tmp
  tmp="$(mktemp)"

  case "${tool}" in
    npm)
      cmd=(npm audit --omit=dev --json)
      ;;
    pnpm)
      cmd=(pnpm audit --prod --json)
      ;;
    *)
      echo "Unsupported audit tool '${tool}'" >&2
      return 1
      ;;
  esac

  local status=0
  if ! "${cmd[@]}" >"${tmp}"; then
    status=$?
  fi

  if [[ ${status} -ne 0 && ${status} -ne 1 ]]; then
    echo "${tool} audit failed with status ${status}" >&2
    cat "${tmp}" >&2 || true
    rm -f "${tmp}"
    exit ${status}
  fi

  if jq -e 'has("error")' "${tmp}" >/dev/null 2>&1; then
    echo "${tool} audit returned an error response" >&2
    cat "${tmp}" >&2 || true
    rm -f "${tmp}"
    exit 1
  fi

  jq -c '
    .vulnerabilities // {} | to_entries[] |
    .value as $v |
    select($v.severity == "high" or $v.severity == "critical") |
    {
      severity: $v.severity,
      package: $v.name,
      identifiers: (
        [$v.id] +
        [($v.via // [])[] | if type == "object" then (.id // .source // .name // .title // .url) else . end]
      | map(select(. != null and . != "")) | unique)
    }
  ' "${tmp}" || true
  rm -f "${tmp}"
}

collect_findings() {
  local tool="$1"
  local findings_json
  findings_json="$2"
  local disallowed=()

  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    local pkg severity
    pkg="$(jq -r '.package' <<<"${line}")"
    severity="$(jq -r '.severity' <<<"${line}")"
    local -a ids=()
    mapfile -t ids < <(jq -r '.identifiers[]?' <<<"${line}")
    local joined_ids=""
    if (( ${#ids[@]} > 0 )); then
      joined_ids="$(IFS=', '; echo "${ids[*]}")"
    fi

    local allowed=false
    if is_allowed "${pkg}"; then
      allowed=true
    else
      for id in "${ids[@]}"; do
        if is_allowed "${id}"; then
          allowed=true
          break
        fi
      done
    fi

    if [[ "${allowed}" == false ]]; then
      disallowed+=("${severity}|${pkg}|${joined_ids}")
    fi
  done <<<"${findings_json}"

  if (( ${#disallowed[@]} > 0 )); then
    echo "${tool} audit detected disallowed vulnerabilities:" >&2
    for entry in "${disallowed[@]}"; do
      IFS='|' read -r sev pkg ids <<<"${entry}"
      echo "  - ${pkg} (${sev}) identifiers: ${ids}" >&2
    done
    return 1
  fi
  return 0
}

main() {
  cd "${WORKSPACE_DIR}"

  require_tool jq

  if [[ -f "pnpm-lock.yaml" ]]; then
    if ! command -v pnpm >/dev/null 2>&1; then
      if command -v corepack >/dev/null 2>&1; then
        corepack enable pnpm >/dev/null 2>&1 || true
      fi
    fi
    require_tool pnpm
  fi

  echo "Generating CycloneDX SBOM at ${SBOM_PATH}"
  npx --yes @cyclonedx/cyclonedx-npm \
    --output-format json \
    --output-file "${SBOM_PATH}" \
    --flatten-components

  local audit_failed=false

  if [[ -f "package-lock.json" ]]; then
    echo "Running npm audit (production)"
    local npm_findings
    npm_findings="$(run_audit npm || true)"
    if [[ -n "${npm_findings}" ]]; then
      if ! collect_findings npm "${npm_findings}"; then
        audit_failed=true
      fi
    fi
  fi

  if [[ -f "pnpm-lock.yaml" ]]; then
    echo "Running pnpm audit (production)"
    local pnpm_findings
    pnpm_findings="$(run_audit pnpm || true)"
    if [[ -n "${pnpm_findings}" ]]; then
      if ! collect_findings pnpm "${pnpm_findings}"; then
        audit_failed=true
      fi
    fi
  fi

  if [[ "${audit_failed}" == true ]]; then
    echo "High or critical vulnerabilities detected." >&2
    exit 1
  fi

  echo "SBOM generation and audits completed successfully."
}

main "$@"
