#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_SCRIPT_PATH="/tmp/apply_media_main_domain_chengxvblog_remote.py"
REMOTE_HOST="${REMOTE_HOST:-152.136.237.31}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

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

main() {
  require_cmd expect
  require_cmd scp
  require_cmd ssh
  require_env REMOTE_PASSWORD

  echo "上传远端媒体主域收口脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/apply_media_main_domain_chengxvblog_remote.py" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端执行媒体主域收口"
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "python3 '${REMOTE_SCRIPT_PATH}'"
}

main "$@"
