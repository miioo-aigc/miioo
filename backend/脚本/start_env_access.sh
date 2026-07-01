#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/env.txt}"
MODE="${1:-help}"

PUBLIC_START_SCRIPT="${BACKEND_DIR}/start_public.sh"
CLOUD_START_SCRIPT="${SCRIPT_DIR}/start_cloud.sh"
STOP_PUBLIC_TUNNEL_SCRIPT="${BACKEND_DIR}/stop_public_tunnel.sh"
RUNTIME_PUBLIC_URL_FILE="${BACKEND_DIR}/.runtime/cloudflared_public_url"

print_help() {
  cat <<'EOF'
读取根目录 env.txt 的公网访问启动脚本

用法：
  bash backend/脚本/start_env_access.sh public
  bash backend/脚本/start_env_access.sh public-db
  bash backend/脚本/start_env_access.sh cloud
  bash backend/脚本/start_env_access.sh cloud-worker
  bash backend/脚本/start_env_access.sh stop-public

默认读取：
  /Users/xingyi/Desktop/迭代一版/env.txt

说明：
  public       读取 env.txt 后，以公网隧道模式启动后端，适合“全能参考生视频”联调
  public-db    同上，但先检查/启动本地数据库
  cloud        读取 env.txt 后，以正式云端 HTTPS 域名口径启动 Web
  cloud-worker 读取 env.txt 后，以正式云端 HTTPS 域名口径启动 Worker
  stop-public  关闭本地公网隧道并清理 .runtime 临时公网地址

可覆盖环境变量：
  ENV_FILE=/custom/path/env.txt
EOF
}

require_file() {
  local file_path="$1"
  if [ ! -f "${file_path}" ]; then
    echo "未找到文件: ${file_path}" >&2
    exit 1
  fi
}

load_env_file() {
  require_file "${ENV_FILE}"

  while IFS= read -r raw_line || [ -n "${raw_line}" ]; do
    case "${raw_line}" in
      ""|\#*)
        continue
        ;;
    esac

    local key="${raw_line%%=*}"
    local value="${raw_line#*=}"

    if [[ ! "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "检测到不合法的环境变量名: ${key}" >&2
      exit 1
    fi

    export "${key}=${value}"
  done < "${ENV_FILE}"
}

run_script() {
  local script_path="$1"
  shift || true
  require_file "${script_path}"
  cd "${BACKEND_DIR}"
  exec bash "${script_path}" "$@"
}

prepare_public_mode() {
  export PUBLIC_BASE_URL=""
  export PUBLIC_BASE_URL_FILE="${RUNTIME_PUBLIC_URL_FILE}"
  export SERVE_UPLOADS_VIA_APP="true"
  export MEDIA_PUBLIC_BASE_URL=""
  export MEDIA_CDN_BASE_URL=""
}

prepare_cloud_mode() {
  export PUBLIC_BASE_URL_FILE=""
  export SERVE_UPLOADS_VIA_APP="${SERVE_UPLOADS_VIA_APP:-false}"
}

main() {
  case "${MODE}" in
    help|-h|--help)
      print_help
      exit 0
      ;;
    stop-public)
      run_script "${STOP_PUBLIC_TUNNEL_SCRIPT}"
      ;;
  esac

  load_env_file

  case "${MODE}" in
    public)
      prepare_public_mode
      PUBLIC_BACKEND_MODE=dev run_script "${PUBLIC_START_SCRIPT}"
      ;;
    public-db)
      prepare_public_mode
      PUBLIC_BACKEND_MODE=db run_script "${PUBLIC_START_SCRIPT}"
      ;;
    cloud)
      prepare_cloud_mode
      run_script "${CLOUD_START_SCRIPT}" web
      ;;
    cloud-worker)
      prepare_cloud_mode
      run_script "${CLOUD_START_SCRIPT}" worker
      ;;
    *)
      echo "不支持的模式: ${MODE}" >&2
      print_help
      exit 1
      ;;
  esac
}

main "$@"
