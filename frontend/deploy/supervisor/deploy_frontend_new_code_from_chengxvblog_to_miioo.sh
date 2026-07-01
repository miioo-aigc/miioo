#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

TEST_REMOTE_HOST="${TEST_REMOTE_HOST:-152.136.237.31}"
TEST_REMOTE_USER="${TEST_REMOTE_USER:-root}"
TEST_REMOTE_TARGET="${TEST_REMOTE_USER}@${TEST_REMOTE_HOST}"
TEST_REMOTE_FRONTEND_DIR="${TEST_REMOTE_FRONTEND_DIR:-/www/wwwroot/chengxvblog.top/frontend_new}"
TEST_REMOTE_SUPERVISOR_CONF="${TEST_REMOTE_SUPERVISOR_CONF:-/etc/supervisor/conf.d/chengxvblog-frontend-new.conf}"
TEST_REMOTE_SCRIPT_PATH="/tmp/export_frontend_new_release_chengxvblog.sh"

PROD_REMOTE_HOST="${PROD_REMOTE_HOST:-129.211.162.176}"
PROD_REMOTE_USER="${PROD_REMOTE_USER:-root}"
PROD_REMOTE_TARGET="${PROD_REMOTE_USER}@${PROD_REMOTE_HOST}"
PROD_REMOTE_SCRIPT_PATH="/tmp/refresh_frontend_new_code_remote_miioo.sh"

LOCAL_STAGE_BASE="${LOCAL_STAGE_BASE:-${PROJECT_ROOT}/.tmp/frontend_new_release_from_chengxvblog}"

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

run_with_password() {
  local password="$1"
  shift
  local program=("$@")
  REMOTE_PASSWORD="${password}" expect -f - -- "${program[@]}" <<'EOF'
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

run_test() {
  run_with_password "${TEST_REMOTE_PASSWORD}" "$@"
}

run_prod() {
  run_with_password "${PROD_REMOTE_PASSWORD}" "$@"
}

write_remote_export_script() {
  local script_path="$1"
  cat > "${script_path}" <<'EOF'
#!/bin/bash
set -euo pipefail

LIVE_FRONTEND_DIR="${1:-}"
SUPERVISOR_CONF="${2:-}"
ARCHIVE_PATH="${3:-}"

current_frontend_dir() {
  if [ -f "${SUPERVISOR_CONF}" ]; then
    awk -F= '/^directory=/{print $2; exit}' "${SUPERVISOR_CONF}"
    return
  fi
  printf '%s\n' "${LIVE_FRONTEND_DIR}"
}

if [ -z "${LIVE_FRONTEND_DIR}" ] || [ -z "${SUPERVISOR_CONF}" ] || [ -z "${ARCHIVE_PATH}" ]; then
  echo "用法: bash export_frontend_new_release_chengxvblog.sh <live_frontend_dir> <supervisor_conf> <archive_path>" >&2
  exit 1
fi

CURRENT_FRONTEND_DIR="$(current_frontend_dir)"
if [ -z "${CURRENT_FRONTEND_DIR}" ] || [ ! -d "${CURRENT_FRONTEND_DIR}" ]; then
  echo "未找到当前运行中的 frontend_new 目录: ${CURRENT_FRONTEND_DIR}" >&2
  exit 1
fi

if [ ! -f "${CURRENT_FRONTEND_DIR}/package.json" ] || [ ! -d "${CURRENT_FRONTEND_DIR}/src" ]; then
  echo "当前运行目录不是有效的 frontend_new 工程: ${CURRENT_FRONTEND_DIR}" >&2
  exit 1
fi

rm -f "${ARCHIVE_PATH}"
tar -czf "${ARCHIVE_PATH}" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='dist.zip' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='logs' \
  -C "$(dirname "${CURRENT_FRONTEND_DIR}")" \
  "$(basename "${CURRENT_FRONTEND_DIR}")"

echo "CURRENT_FRONTEND_DIR=${CURRENT_FRONTEND_DIR}"
echo "REMOTE_ARCHIVE=${ARCHIVE_PATH}"
EOF
}

print_help() {
  cat <<'EOF'
用途：
  从 152 测试机当前运行中的 frontend_new 目录导出代码快照，
  通过本地中转后同步到 129 的新目录，仅落代码，不切生产入口。

用法：
  TEST_REMOTE_PASSWORD='152 密码' \
  PROD_REMOTE_PASSWORD='129 密码' \
  bash frontend_new/deploy/supervisor/deploy_frontend_new_code_from_chengxvblog_to_miioo.sh

可覆盖环境变量：
  TEST_REMOTE_HOST=152.136.237.31
  TEST_REMOTE_USER=root
  TEST_REMOTE_FRONTEND_DIR=/www/wwwroot/chengxvblog.top/frontend_new
  TEST_REMOTE_SUPERVISOR_CONF=/etc/supervisor/conf.d/chengxvblog-frontend-new.conf
  PROD_REMOTE_HOST=129.211.162.176
  PROD_REMOTE_USER=root
  LOCAL_STAGE_BASE=/Users/xingyi/Desktop/tmp/frontend_new_release_from_chengxvblog

默认行为：
  - 从 152 当前 Supervisor 指向的 frontend_new 运行目录导出代码快照
  - 不导出 .env / .env.* / node_modules / dist / logs
  - 把归档先下载到本地中转目录，再上传到 129
  - 只调用 129 的 refresh_frontend_new_code_remote_miioo.sh 做新目录落包
  - 不修改 129 的 Nginx / CDN / Supervisor / 生产主域名入口
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
  require_env TEST_REMOTE_PASSWORD
  require_env PROD_REMOTE_PASSWORD

  local ts run_dir remote_archive_name remote_archive_path local_archive_path
  local remote_helper_local
  ts="$(date +%Y%m%d_%H%M%S)"
  run_dir="${LOCAL_STAGE_BASE}/${ts}"
  remote_archive_name="chengxvblog_frontend_new_release_${ts}.tgz"
  remote_archive_path="/tmp/${remote_archive_name}"
  local_archive_path="${run_dir}/${remote_archive_name}"
  remote_helper_local="$(mktemp)"

  mkdir -p "${run_dir}"
  write_remote_export_script "${remote_helper_local}"

  echo "上传 152 远端导出脚本到 ${TEST_REMOTE_TARGET}:${TEST_REMOTE_SCRIPT_PATH}"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${remote_helper_local}" \
    "${TEST_REMOTE_TARGET}:${TEST_REMOTE_SCRIPT_PATH}"

  echo "在 152 远端打包当前运行中的 frontend_new 代码"
  run_test ssh \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}" \
    "bash '${TEST_REMOTE_SCRIPT_PATH}' '${TEST_REMOTE_FRONTEND_DIR}' '${TEST_REMOTE_SUPERVISOR_CONF}' '${remote_archive_path}'"

  echo "下载 152 发布归档到本地中转目录 ${local_archive_path}"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}:${remote_archive_path}" \
    "${local_archive_path}"

  echo "清理 152 远端临时文件"
  run_test ssh \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}" \
    "rm -f '${TEST_REMOTE_SCRIPT_PATH}' '${remote_archive_path}'"

  echo "上传 152 发布归档到 129:${remote_archive_path}"
  run_prod scp \
    -o StrictHostKeyChecking=accept-new \
    "${local_archive_path}" \
    "${PROD_REMOTE_TARGET}:${remote_archive_path}"

  echo "上传 129 远端落包脚本到 ${PROD_REMOTE_TARGET}:${PROD_REMOTE_SCRIPT_PATH}"
  run_prod scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/refresh_frontend_new_code_remote_miioo.sh" \
    "${PROD_REMOTE_TARGET}:${PROD_REMOTE_SCRIPT_PATH}"

  echo "开始执行 129 新目录落包"
  run_prod ssh \
    -o StrictHostKeyChecking=accept-new \
    "${PROD_REMOTE_TARGET}" \
    "SOURCE_LABEL='152:${TEST_REMOTE_FRONTEND_DIR}' bash '${PROD_REMOTE_SCRIPT_PATH}' '${remote_archive_name}'"

  rm -f "${remote_helper_local}"

  echo "已完成 152 -> 129 frontend_new 代码同步"
  echo "本地中转目录: ${run_dir}"
}

main "$@"
