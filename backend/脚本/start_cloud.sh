#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

source "${BACKEND_DIR}/_runtime_bootstrap.sh"

STOP_PUBLIC_TUNNEL_SCRIPT="${BACKEND_DIR}/stop_public_tunnel.sh"
PROD_WEB_SCRIPT="${SCRIPT_DIR}/start_prod.sh"
PROD_WORKER_SCRIPT="${BACKEND_DIR}/start_worker.sh"
TARGET="${1:-web}"
APP_ENV="${APP_ENV:-production}"
BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE:-queue}"
SERVE_UPLOADS_VIA_APP="${SERVE_UPLOADS_VIA_APP:-false}"
CLOUD_PUBLIC_BASE_URL="${CLOUD_PUBLIC_BASE_URL:-${PUBLIC_BASE_URL:-}}"

print_help() {
  cat <<'EOF'
云端启动脚本

用法：
  bash backend/脚本/start_cloud.sh
  bash backend/脚本/start_cloud.sh web
  bash backend/脚本/start_cloud.sh worker

默认行为：
  - 启动前先关闭本地公网隧道，并清理 .runtime 下的临时公网地址文件
  - 强制忽略 PUBLIC_BASE_URL_FILE 这类本地运行时覆盖
  - 强制使用 SERVE_UPLOADS_VIA_APP=false，交给 Nginx 直接承接 /uploads/
  - 默认按生产口径启动：APP_ENV=production、BACKGROUND_JOB_EXECUTION_MODE=queue

可覆盖环境变量：
  CLOUD_PUBLIC_BASE_URL=https://www.miiooai.com
  PROD_VENV_DIR=/your/backend/.venv
  WORKERS=4

说明：
  - web    启动生产 Web 进程
  - worker 启动生产 Worker 进程
EOF
}

read_last_env_value() {
  local key="$1"
  local env_file="${BACKEND_DIR}/.env"

  if [ ! -f "${env_file}" ]; then
    return
  fi

  awk -F '=' -v key="${key}" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END {
      if (value != "") {
        print value
      }
    }
  ' "${env_file}"
}

resolve_public_base_url() {
  local value="${CLOUD_PUBLIC_BASE_URL}"

  if [ -z "${value}" ]; then
    value="$(read_last_env_value "PUBLIC_BASE_URL")"
  fi

  printf '%s' "${value}"
}

validate_public_base_url() {
  local value="$1"

  if [ -z "${value}" ]; then
    echo "未检测到可用的 PUBLIC_BASE_URL，请先在 backend/.env 或 CLOUD_PUBLIC_BASE_URL 中提供云端公网域名。" >&2
    exit 1
  fi

  if [[ ! "${value}" =~ ^https:// ]]; then
    echo "云端启动要求 PUBLIC_BASE_URL 使用 HTTPS 域名，当前值为：${value}" >&2
    exit 1
  fi

  if [[ "${value}" =~ trycloudflare\.com|loca\.lt|localhost|127\.0\.0\.1 ]]; then
    echo "云端启动检测到 PUBLIC_BASE_URL 仍像本地联调地址，请改成正式公网域名后再启动：${value}" >&2
    exit 1
  fi
}

run_target() {
  local target="$1"
  local public_base_url="$2"

  echo "☁️ 当前按云端口径启动：TARGET=${target}"
  echo "   - APP_ENV=${APP_ENV}"
  echo "   - BACKGROUND_JOB_EXECUTION_MODE=${BACKGROUND_JOB_EXECUTION_MODE}"
  echo "   - SERVE_UPLOADS_VIA_APP=${SERVE_UPLOADS_VIA_APP}"
  echo "   - PUBLIC_BASE_URL=${public_base_url}"
  echo "   - PUBLIC_BASE_URL_FILE=<empty>"

  case "${target}" in
    web)
      exec env \
        APP_ENV="${APP_ENV}" \
        BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE}" \
        SERVE_UPLOADS_VIA_APP="${SERVE_UPLOADS_VIA_APP}" \
        PUBLIC_BASE_URL="${public_base_url}" \
        PUBLIC_BASE_URL_FILE="" \
        bash "${PROD_WEB_SCRIPT}"
      ;;
    worker)
      exec env \
        APP_ENV="${APP_ENV}" \
        BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE}" \
        SERVE_UPLOADS_VIA_APP="${SERVE_UPLOADS_VIA_APP}" \
        PUBLIC_BASE_URL="${public_base_url}" \
        PUBLIC_BASE_URL_FILE="" \
        bash "${PROD_WORKER_SCRIPT}"
      ;;
    *)
      echo "不支持的启动目标: ${target}，可选值: web / worker" >&2
      exit 1
      ;;
  esac
}

main() {
  local public_base_url=""

  case "${TARGET}" in
    help|-h|--help)
      print_help
      exit 0
      ;;
  esac

  require_file() {
    if [ ! -f "$1" ]; then
      echo "未找到脚本: $1" >&2
      exit 1
    fi
  }

  require_file "${STOP_PUBLIC_TUNNEL_SCRIPT}"
  require_file "${PROD_WEB_SCRIPT}"
  require_file "${PROD_WORKER_SCRIPT}"

  bash "${STOP_PUBLIC_TUNNEL_SCRIPT}" --quiet-if-none

  public_base_url="$(resolve_public_base_url)"
  validate_public_base_url "${public_base_url}"
  run_target "${TARGET}" "${public_base_url}"
}

main "$@"
