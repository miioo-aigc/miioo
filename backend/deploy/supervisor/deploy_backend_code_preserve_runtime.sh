#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-129.211.162.176}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_SCRIPT_PATH="/tmp/refresh_backend_code_remote.sh"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "缺少环境变量: ${name}" >&2
    exit 1
  fi
}

run_with_expect() {
  local program=("$@")
  REMOTE_PASSWORD="${REMOTE_PASSWORD}" expect -f - -- "${program[@]}" <<'EOF'
set timeout -1
set password $env(REMOTE_PASSWORD)
set program [lrange $argv 0 end]
spawn {*}$program
expect {
  -re "(?i)yes/no" {
    send -- "yes\r"
    exp_continue
  }
  -re "(?i)password:" {
    send -- "$password\r"
    exp_continue
  }
  eof {
    catch wait result
    set exit_code [lindex $result 3]
    exit $exit_code
  }
}
EOF
}

print_help() {
  cat <<'EOF'
用途：
  只更新后端代码，不覆盖线上已存在的 `.env / uploads / .venv / .runtime`，
  并保留当前 COS、Nginx、Supervisor 真实配置。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash backend/deploy/supervisor/deploy_backend_code_preserve_runtime.sh

可覆盖环境变量：
  REMOTE_HOST=129.211.162.176
  REMOTE_USER=root

默认行为：
  - 本地打包后端代码、迁移、启动脚本和部署模板
  - 不打包 `.env / .env copy / .env prod / uploads / .venv / .runtime`
  - 远端先备份当前代码，再解包覆盖代码文件
  - 执行 `pip install -r requirements.txt`
  - 执行 `alembic upgrade head`
  - 执行 `supervisorctl reread/update/restart`
EOF
}

main() {
  if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    print_help
    exit 0
  fi

  require_cmd tar
  require_cmd scp
  require_cmd ssh
  require_cmd expect
  require_env REMOTE_PASSWORD

  local ts archive archive_name
  ts="$(date +%Y%m%d_%H%M%S)"
  archive="/tmp/miioo_backend_code_${ts}.tgz"
  archive_name="$(basename "${archive}")"

  COPYFILE_DISABLE=1 tar \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    -czf "${archive}" \
    -C "${PROJECT_ROOT}" \
    backend/app \
    backend/alembic \
    backend/deploy \
    backend/nginx \
    backend/scripts \
    "backend/脚本" \
    backend/_runtime_bootstrap.sh \
    backend/alembic.ini \
    backend/requirements.txt \
    backend/start.sh \
    backend/start_public.sh \
    backend/start_worker.sh \
    backend/stop_public_tunnel.sh \
    backend/tunnel.sh \
    backend/BACKEND_API_DOC.md \
    backend/.env.example

  echo "上传后端代码包到 ${REMOTE_TARGET}:/tmp/${archive_name}"
  run_with_expect scp \
    -O \
    -o StrictHostKeyChecking=accept-new \
    "${archive}" \
    "${REMOTE_TARGET}:/tmp/${archive_name}"

  echo "上传远端刷新脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -O \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/refresh_backend_code_remote.sh" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端刷新后端代码并保留现有运行配置"
  run_with_expect ssh \
    -tt \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "bash '${REMOTE_SCRIPT_PATH}' '${archive_name}'"

  echo "后端代码已完成上传部署，线上配置保持不变"
}

main "$@"
