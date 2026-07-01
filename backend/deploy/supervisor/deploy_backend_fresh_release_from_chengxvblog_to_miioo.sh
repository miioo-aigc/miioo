#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

TEST_REMOTE_HOST="${TEST_REMOTE_HOST:-152.136.237.31}"
TEST_REMOTE_USER="${TEST_REMOTE_USER:-root}"
TEST_REMOTE_TARGET="${TEST_REMOTE_USER}@${TEST_REMOTE_HOST}"
TEST_REMOTE_BACKEND_DIR="${TEST_REMOTE_BACKEND_DIR:-/www/wwwroot/chengxvblog.top/backend}"
TEST_REMOTE_SCRIPT_PATH="/tmp/export_backend_release_chengxvblog.sh"

PROD_REMOTE_HOST="${PROD_REMOTE_HOST:-129.211.162.176}"
PROD_REMOTE_USER="${PROD_REMOTE_USER:-root}"
PROD_REMOTE_TARGET="${PROD_REMOTE_USER}@${PROD_REMOTE_HOST}"
PROD_REMOTE_SCRIPT_PATH="/tmp/refresh_backend_fresh_release_remote.sh"

LOCAL_STAGE_BASE="${LOCAL_STAGE_BASE:-${PROJECT_ROOT}/.tmp/backend_release_from_chengxvblog}"

INCLUDE_ITEMS=(
  "app"
  "alembic"
  "deploy"
  "nginx"
  "scripts"
  "脚本"
  "_runtime_bootstrap.sh"
  "alembic.ini"
  "requirements.txt"
  "start.sh"
  "start_public.sh"
  "start_worker.sh"
  "stop_public_tunnel.sh"
  "tunnel.sh"
  "BACKEND_API_DOC.md"
  ".env.example"
)

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

BACKEND_DIR="${1:-}"
ARCHIVE_PATH="${2:-}"
shift 2 || true

if [ -z "${BACKEND_DIR}" ] || [ -z "${ARCHIVE_PATH}" ]; then
  echo "用法: bash export_backend_release_chengxvblog.sh <backend_dir> <archive_path> [items...]" >&2
  exit 1
fi

if [ ! -d "${BACKEND_DIR}" ]; then
  echo "未找到远端后端目录: ${BACKEND_DIR}" >&2
  exit 1
fi

cd "${BACKEND_DIR}"

existing_items=()
for item in "$@"; do
  if [ -e "${item}" ]; then
    existing_items+=("${item}")
  fi
done

if [ "${#existing_items[@]}" -eq 0 ]; then
  echo "远端未找到可导出的后端代码项" >&2
  exit 1
fi

rm -f "${ARCHIVE_PATH}"
tar -czf "${ARCHIVE_PATH}" "${existing_items[@]}"
echo "REMOTE_ARCHIVE=${ARCHIVE_PATH}"
EOF
}

print_help() {
  cat <<'EOF'
用途：
  从 152 测试机当前运行中的 backend 目录导出代码快照，
  再以该快照为源发布到 129 生产机的新目录 release。

用法：
  TEST_REMOTE_PASSWORD='152 密码' \
  PROD_REMOTE_PASSWORD='129 密码' \
  bash backend/deploy/supervisor/deploy_backend_fresh_release_from_chengxvblog_to_miioo.sh

可覆盖环境变量：
  TEST_REMOTE_HOST=152.136.237.31
  TEST_REMOTE_USER=root
  TEST_REMOTE_BACKEND_DIR=/www/wwwroot/chengxvblog.top/backend
  PROD_REMOTE_HOST=129.211.162.176
  PROD_REMOTE_USER=root
  LOCAL_STAGE_BASE=/Users/xingyi/Desktop/tmp/backend_release_from_chengxvblog

默认行为：
  - 从 152 导出 app/alembic/deploy/nginx/scripts/脚本 等后端代码项
  - 不导出 .env / uploads / .venv / .runtime / logs
  - 把归档先下载到本地中转目录，再上传到 129
  - 复用 129 的 refresh_backend_fresh_release_remote.sh 做新目录 release
  - 保留 129 线上 .env / Supervisor / Nginx / uploads / COS/CDN 运行配置
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
  local remote_helper_local remote_command remote_item
  ts="$(date +%Y%m%d_%H%M%S)"
  run_dir="${LOCAL_STAGE_BASE}/${ts}"
  remote_archive_name="chengxvblog_backend_release_${ts}.tgz"
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

  echo "在 152 远端打包当前运行后端代码"
  remote_command="$(printf "bash %q %q %q" "${TEST_REMOTE_SCRIPT_PATH}" "${TEST_REMOTE_BACKEND_DIR}" "${remote_archive_path}")"
  for remote_item in "${INCLUDE_ITEMS[@]}"; do
    remote_command+=" $(printf "%q" "${remote_item}")"
  done
  run_test ssh \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}" \
    "${remote_command}"

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

  echo "上传 129 新目录发布脚本到 ${PROD_REMOTE_TARGET}:${PROD_REMOTE_SCRIPT_PATH}"
  run_prod scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/refresh_backend_fresh_release_remote.sh" \
    "${PROD_REMOTE_TARGET}:${PROD_REMOTE_SCRIPT_PATH}"

  echo "开始执行 129 新目录 release"
  run_prod ssh \
    -o StrictHostKeyChecking=accept-new \
    "${PROD_REMOTE_TARGET}" \
    "SOURCE_LABEL='152:${TEST_REMOTE_BACKEND_DIR}' bash '${PROD_REMOTE_SCRIPT_PATH}' '${remote_archive_name}'"

  echo "已完成 152 -> 129 后端新目录发布"
  echo "本地中转目录: ${run_dir}"
}

main "$@"
