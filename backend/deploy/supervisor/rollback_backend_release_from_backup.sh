#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_HOST="${REMOTE_HOST:-129.211.162.176}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_SCRIPT_PATH="/tmp/rollback_backend_release_remote.sh"
SUPERVISOR_BACKUP_PATH="${SUPERVISOR_BACKUP_PATH:-}"
BACKEND_FULL_BACKUP_PATH="${BACKEND_FULL_BACKUP_PATH:-}"

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
  回滚 129 服务器当前新 release，让 miioo-web / miioo-worker 恢复到指定的
  Supervisor 备份配置；如有需要，也可同时从 backend_full_before_*.tgz 恢复旧 backend 目录。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  SUPERVISOR_BACKUP_PATH='/www/wwwroot/miiooaib.com/deploy_backups/miioo-backend.ini.before_20260625_095507' \
  bash backend/deploy/supervisor/rollback_backend_release_from_backup.sh

可选恢复旧 backend 目录：
  REMOTE_PASSWORD='你的服务器密码' \
  SUPERVISOR_BACKUP_PATH='/www/wwwroot/miiooaib.com/deploy_backups/miioo-backend.ini.before_20260625_095507' \
  BACKEND_FULL_BACKUP_PATH='/www/wwwroot/miiooaib.com/deploy_backups/backend_full_before_20260625_095507.tgz' \
  bash backend/deploy/supervisor/rollback_backend_release_from_backup.sh

说明：
  - 默认仅恢复 Supervisor 配置并重启服务
  - 传入 BACKEND_FULL_BACKUP_PATH 时，会先备份当前 backend，再从完整备份包还原 backend 目录
EOF
}

main() {
  if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    print_help
    exit 0
  fi

  require_cmd scp
  require_cmd ssh
  require_cmd expect
  require_env REMOTE_PASSWORD
  require_env SUPERVISOR_BACKUP_PATH

  echo "上传远端回滚脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/rollback_backend_release_remote.sh" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "开始执行云端回滚"
  if [ -n "${BACKEND_FULL_BACKUP_PATH}" ]; then
    run_with_expect ssh \
      -o StrictHostKeyChecking=accept-new \
      "${REMOTE_TARGET}" \
      "bash '${REMOTE_SCRIPT_PATH}' '${SUPERVISOR_BACKUP_PATH}' '${BACKEND_FULL_BACKUP_PATH}'"
  else
    run_with_expect ssh \
      -o StrictHostKeyChecking=accept-new \
      "${REMOTE_TARGET}" \
      "bash '${REMOTE_SCRIPT_PATH}' '${SUPERVISOR_BACKUP_PATH}'"
  fi

  echo "云端回滚已执行完成"
}

main "$@"
