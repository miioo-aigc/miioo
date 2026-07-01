#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-152.136.237.31}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_BACKEND_DIR="${REMOTE_BACKEND_DIR:-/www/wwwroot/chengxvblog.top/backend}"
REMOTE_SCRIPT_PATH="/tmp/export_backend_compare_chengxvblog.sh"

LOCAL_OUTPUT_BASE="${LOCAL_OUTPUT_BASE:-${PROJECT_ROOT}/.tmp/backend_remote_compare}"

INCLUDE_ITEMS=(
  "app"
  "alembic"
  "deploy"
  "nginx"
  "scripts"
  "脚本"
  "tests"
  "loadtest"
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
  从 chengxvblog 云端后端目录拉取一份“代码快照”到本地，
  并与当前本地 backend 做只读差异检查，不碰线上 .env / uploads / logs 等运行态内容。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash backend/deploy/supervisor/compare_backend_with_remote_chengxvblog.sh

可覆盖环境变量：
  REMOTE_HOST=152.136.237.31
  REMOTE_USER=root
  REMOTE_BACKEND_DIR=/www/wwwroot/chengxvblog.top/backend
  LOCAL_OUTPUT_BASE=/Users/xingyi/Desktop/backend_remote_compare
EOF
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
  echo "用法: bash export_backend_compare_chengxvblog.sh <backend_dir> <archive_path> [items...]" >&2
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
  echo "远端未找到可导出的代码项" >&2
  exit 1
fi

rm -f "${ARCHIVE_PATH}"
tar -czf "${ARCHIVE_PATH}" "${existing_items[@]}"
echo "REMOTE_ARCHIVE=${ARCHIVE_PATH}"
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
  require_cmd diff
  require_env REMOTE_PASSWORD

  local ts run_dir remote_snapshot_dir local_snapshot_dir report_path
  local remote_archive_name remote_archive_path local_archive_path local_stage_archive
  local remote_helper_local remote_command remote_item
  ts="$(date +%Y%m%d_%H%M%S)"
  run_dir="${LOCAL_OUTPUT_BASE}/${ts}"
  remote_snapshot_dir="${run_dir}/remote_backend"
  local_snapshot_dir="${run_dir}/local_backend"
  report_path="${run_dir}/diff_report.txt"
  remote_archive_name="chengxvblog_backend_compare_${ts}.tgz"
  remote_archive_path="/tmp/${remote_archive_name}"
  local_archive_path="${run_dir}/${remote_archive_name}"
  local_stage_archive="${run_dir}/local_backend_snapshot.tgz"
  remote_helper_local="$(mktemp)"

  mkdir -p "${run_dir}" "${remote_snapshot_dir}" "${local_snapshot_dir}"
  write_remote_export_script "${remote_helper_local}"

  echo "上传远端导出脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${remote_helper_local}" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端打包后端代码快照"
  remote_command="$(printf "bash %q %q %q" "${REMOTE_SCRIPT_PATH}" "${REMOTE_BACKEND_DIR}" "${remote_archive_path}")"
  for remote_item in "${INCLUDE_ITEMS[@]}"; do
    remote_command+=" $(printf "%q" "${remote_item}")"
  done
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "${remote_command}"

  echo "下载远端后端代码快照到本地"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}:${remote_archive_path}" \
    "${local_archive_path}"

  echo "清理远端临时文件"
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "rm -f '${REMOTE_SCRIPT_PATH}' '${remote_archive_path}'"

  tar -xzf "${local_archive_path}" -C "${remote_snapshot_dir}"

  local local_items=()
  for item in "${INCLUDE_ITEMS[@]}"; do
    if [ -e "${PROJECT_ROOT}/backend/${item}" ]; then
      local_items+=("${item}")
    fi
  done

  if [ "${#local_items[@]}" -eq 0 ]; then
    echo "本地 backend 中未找到可比对的代码项" >&2
    exit 1
  fi

  tar -czf "${local_stage_archive}" -C "${PROJECT_ROOT}/backend" "${local_items[@]}"
  tar -xzf "${local_stage_archive}" -C "${local_snapshot_dir}"

  local diff_exit=0
  if ! diff -qr \
    -x "__pycache__" \
    -x "*.pyc" \
    -x ".pytest_cache" \
    -x ".mypy_cache" \
    -x ".ruff_cache" \
    "${local_snapshot_dir}" \
    "${remote_snapshot_dir}" > "${report_path}"; then
    diff_exit=$?
  fi

  if [ "${diff_exit}" -gt 1 ]; then
    echo "差异比对执行失败，请检查: ${report_path}" >&2
    exit "${diff_exit}"
  fi

  if [ "${diff_exit}" -eq 0 ]; then
    cat <<EOF
本地与云端后端代码快照已对齐。
快照目录: ${run_dir}
差异报告: ${report_path}
EOF
  else
    cat <<EOF
已完成云端后端代码快照下载，并发现本地与云端存在差异。
快照目录: ${run_dir}
差异报告: ${report_path}
EOF
  fi

  rm -f "${remote_helper_local}"
}

main "$@"
