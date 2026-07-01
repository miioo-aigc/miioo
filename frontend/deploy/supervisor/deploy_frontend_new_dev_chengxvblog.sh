#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)/frontend_new"
REMOTE_HOST="${REMOTE_HOST:-152.136.237.31}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_SCRIPT_PATH="/tmp/refresh_frontend_new_dev_chengxvblog.sh"

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
  把本地最新 frontend_new 以“非破坏性新目录发布”的方式部署到 chengxvblog 云端，
  远端会先备份当前运行态，再在全新 release 目录安装依赖并切换 Supervisor 到新目录。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash frontend_new/deploy/supervisor/deploy_frontend_new_dev_chengxvblog.sh

可覆盖环境变量：
  REMOTE_HOST=152.136.237.31
  REMOTE_USER=root

默认行为：
  - 打包当前 frontend_new 代码，但不打包 .env / .env.* / node_modules / dist
  - 远端先备份当前运行目录、Supervisor 配置和 Nginx 代理片段
  - 远端在 frontend_new_releases/<timestamp>/frontend_new 创建全新发布目录
  - 新目录优先复用当前线上运行目录中的 .env / .npmrc，不覆盖云端环境
  - 新目录依赖安装完成后再切换 chengxvblog-frontend-new 到新目录
  - 若切换后健康检查失败，会自动回滚到旧 Supervisor / Nginx 配置
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
  archive="/tmp/chengxvblog_frontend_new_dev_${ts}.tgz"
  archive_name="$(basename "${archive}")"
  # The test host currently has a broken sftp subsystem, so force legacy SCP.
  scp_cmd=(scp -O -o StrictHostKeyChecking=accept-new)
  ssh_cmd=(ssh -tt -o StrictHostKeyChecking=accept-new)

  COPYFILE_DISABLE=1 tar \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='dist.zip' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='logs' \
    -czf "${archive}" \
    -C "${FRONTEND_ROOT}/.." \
    frontend_new

  echo "上传前端代码包到 ${REMOTE_TARGET}:/tmp/${archive_name}"
  run_with_expect "${scp_cmd[@]}" \
    "${archive}" \
    "${REMOTE_TARGET}:/tmp/${archive_name}"

  echo "上传远端刷新脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect "${scp_cmd[@]}" \
    "${SCRIPT_DIR}/refresh_frontend_new_dev_chengxvblog.sh" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端执行 frontend_new 新目录发布并切换到 3000"
  run_with_expect "${ssh_cmd[@]}" \
    "${REMOTE_TARGET}" \
    "bash '${REMOTE_SCRIPT_PATH}' '${archive_name}'"

  echo "chengxvblog 云端 frontend_new 新目录发布已完成"
}

main "$@"
