#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_CLOUD_BACKEND_DIR="/www/wwwroot/miiooaib.com/backend"
CLOUD_BACKEND_DIR="${CLOUD_BACKEND_DIR:-${DEFAULT_CLOUD_BACKEND_DIR}}"
PROD_VENV_DIR="${PROD_VENV_DIR:-${CLOUD_BACKEND_DIR}/.venv}"
TARGET="${1:-web}"

print_help() {
  cat <<'EOF'
云端固定目录启动脚本

用法：
  bash backend/脚本/start_cloud_server.sh
  bash backend/脚本/start_cloud_server.sh web
  bash backend/脚本/start_cloud_server.sh worker

默认约定：
  - 云端后端目录：/www/wwwroot/miiooaib.com/backend
  - 固定虚拟环境：/www/wwwroot/miiooaib.com/backend/.venv
  - 实际启动逻辑继续复用 backend/脚本/start_cloud.sh

可覆盖环境变量：
  CLOUD_BACKEND_DIR=/your/backend
  PROD_VENV_DIR=/your/backend/.venv
  CLOUD_PUBLIC_BASE_URL=https://www.miiooai.com

说明：
  - web    按云端生产口径启动 Web
  - worker 按云端生产口径启动 Worker
EOF
}

main() {
  case "${TARGET}" in
    help|-h|--help)
      print_help
      exit 0
      ;;
    web|worker)
      ;;
    *)
      echo "不支持的启动目标: ${TARGET}，可选值: web / worker" >&2
      exit 1
      ;;
  esac

  echo "☁️ 使用固定云端目录启动：${CLOUD_BACKEND_DIR}"
  echo "   - TARGET=${TARGET}"
  echo "   - PROD_VENV_DIR=${PROD_VENV_DIR}"

  exec env \
    PROD_VENV_DIR="${PROD_VENV_DIR}" \
    bash "${SCRIPT_DIR}/start_cloud.sh" "${TARGET}"
}

main "$@"
