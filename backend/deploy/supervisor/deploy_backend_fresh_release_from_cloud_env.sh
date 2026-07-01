#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-129.211.162.176}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_SCRIPT_PATH="/tmp/refresh_backend_fresh_release_remote.sh"

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
  先备份云端旧后端，再把当前仓库 backend/ 作为一套“新目录 + 新 .venv”的新后端
  发布到 129 服务器，并在通过健康检查后切换 Supervisor 到新目录。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash backend/deploy/supervisor/deploy_backend_fresh_release_from_cloud_env.sh

可覆盖环境变量：
  REMOTE_HOST=129.211.162.176
  REMOTE_USER=root

默认行为：
  - 打包当前 backend 代码、迁移、部署脚本和启动脚本
  - 不打包 .env / uploads / .venv / .runtime / logs / __pycache__
  - 远端先备份当前 backend 与 miioo-backend.ini
  - 远端在 backend_releases/<timestamp>/backend 创建新目录与新 .venv
  - 新目录直接复制线上 backend/.env
  - 自动执行 pip install 与 alembic upgrade head
  - 健康检查通过后切换 miioo-web / miioo-worker 到新目录
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
  archive="/tmp/miioo_backend_fresh_release_${ts}.tgz"
  archive_name="$(basename "${archive}")"

  COPYFILE_DISABLE=1 tar \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    --exclude='backend/.venv' \
    --exclude='backend/.runtime' \
    --exclude='backend/uploads' \
    --exclude='backend/logs' \
    --exclude='backend/.env' \
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

  echo "上传后端发布包到 ${REMOTE_TARGET}:/tmp/${archive_name}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${archive}" \
    "${REMOTE_TARGET}:/tmp/${archive_name}"

  echo "上传远端新目录发布脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/refresh_backend_fresh_release_remote.sh" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "开始执行云端新目录发布与切换"
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "bash '${REMOTE_SCRIPT_PATH}' '${archive_name}'"

  echo "云端后端已完成备份、新目录发布与切换"
}

main "$@"
