#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-152.136.237.31}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_SCRIPT_PATH="/tmp/refresh_backend_code_remote_chengxvblog.sh"

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
  把本地最新 backend 安全部署到 chengxvblog 云端目录，
  保留线上 .env / uploads / .venv / .runtime / logs 等运行态内容。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash backend/deploy/supervisor/deploy_backend_code_preserve_runtime_chengxvblog.sh

可覆盖环境变量：
  REMOTE_HOST=152.136.237.31
  REMOTE_USER=root
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
  local -a scp_cmd ssh_cmd
  ts="$(date +%Y%m%d_%H%M%S)"
  archive="/tmp/chengxvblog_backend_code_${ts}.tgz"
  archive_name="$(basename "${archive}")"
  # The test host currently has a broken sftp subsystem, so force legacy SCP.
  scp_cmd=(scp -O -o StrictHostKeyChecking=accept-new)
  ssh_cmd=(ssh -tt -o StrictHostKeyChecking=accept-new)

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
    backend/tests \
    backend/loadtest \
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
  run_with_expect "${scp_cmd[@]}" \
    "${archive}" \
    "${REMOTE_TARGET}:/tmp/${archive_name}"

  echo "上传远端刷新脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect "${scp_cmd[@]}" \
    "${SCRIPT_DIR}/refresh_backend_code_remote_chengxvblog.sh" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端刷新 chengxvblog 后端代码并保留运行配置"
  run_with_expect "${ssh_cmd[@]}" \
    "${REMOTE_TARGET}" \
    "bash '${REMOTE_SCRIPT_PATH}' '${archive_name}'"

  echo "chengxvblog 云端后端已完成上传部署"
}

main "$@"
