#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
BUILD_MERGE_SCRIPT="${PROJECT_ROOT}/backend/脚本/build_incremental_merge_sql.py"

TEST_REMOTE_HOST="${TEST_REMOTE_HOST:-152.136.237.31}"
TEST_REMOTE_USER="${TEST_REMOTE_USER:-root}"
TEST_REMOTE_TARGET="${TEST_REMOTE_USER}@${TEST_REMOTE_HOST}"
TEST_REMOTE_BACKEND_DIR="${TEST_REMOTE_BACKEND_DIR:-/www/wwwroot/chengxvblog.top/backend}"
TEST_REMOTE_SCRIPT_PATH="/tmp/export_db_incremental_chengxvblog.sh"

PROD_REMOTE_HOST="${PROD_REMOTE_HOST:-129.211.162.176}"
PROD_REMOTE_USER="${PROD_REMOTE_USER:-root}"
PROD_REMOTE_TARGET="${PROD_REMOTE_USER}@${PROD_REMOTE_HOST}"
PROD_REMOTE_SCRIPT_PATH="/tmp/apply_db_incremental_miioo.sh"

LOCAL_STAGE_BASE="${LOCAL_STAGE_BASE:-${PROJECT_ROOT}/.tmp/db_sync_from_chengxvblog}"

CONFIG_TABLES=(
  "public.api_providers"
  "public.model_configs"
  "public.api_config_banners"
  "public.api_config_card_visibility"
  "public.community_qr_configs"
)

COUNT_TABLES=(
  "users"
  "projects"
  "assets"
  "api_providers"
  "model_configs"
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

write_test_export_script() {
  local script_path="$1"
  cat > "${script_path}" <<'EOF'
#!/bin/bash
set -euo pipefail

BACKEND_DIR="${1:-}"
OUTPUT_DIR="${2:-}"
shift 2 || true

if [ -z "${BACKEND_DIR}" ] || [ -z "${OUTPUT_DIR}" ]; then
  echo "用法: bash export_db_incremental_chengxvblog.sh <backend_dir> <output_dir> [table...]" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

read_database_url() {
  local env_path="${1}"
  ENV_PATH="${env_path}" python3 - <<'PY'
from pathlib import Path
import os

env_path = Path(os.environ["ENV_PATH"])
if not env_path.is_file():
    raise SystemExit(f"未找到环境文件: {env_path}")

for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "DATABASE_URL":
        print(value.strip().strip('"').strip("'"))
        break
else:
    raise SystemExit(f"{env_path} 中未找到 DATABASE_URL")
PY
}

parse_db_url() {
  local db_url="$1"
  DB_URL_INPUT="$db_url" python3 - <<'PY'
from urllib.parse import urlparse
import os

db_url = os.environ["DB_URL_INPUT"].strip()
parsed = urlparse(db_url.replace("+asyncpg", ""))
if parsed.scheme != "postgresql":
    raise SystemExit(f"当前仅支持 PostgreSQL，实际为: {parsed.scheme}")

print(f"HOST={parsed.hostname or 'localhost'}")
print(f"PORT={parsed.port or 5432}")
print(f"USER={parsed.username or ''}")
print(f"PASSWORD={parsed.password or ''}")
print(f"DB_NAME={parsed.path.lstrip('/')}")
PY
}

require_cmd python3
require_cmd pg_dump
require_cmd psql

if [ ! -d "${BACKEND_DIR}" ]; then
  echo "未找到测试机后端目录: ${BACKEND_DIR}" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  echo "请至少传入一张配置表。" >&2
  exit 1
fi

DATABASE_URL="$(read_database_url "${BACKEND_DIR}/.env")"
eval "$(parse_db_url "${DATABASE_URL}")"

mkdir -p "${OUTPUT_DIR}"
ts="$(date +%Y%m%d_%H%M%S)"
config_sql="${OUTPUT_DIR}/incremental_config_tables_${ts}.sql"
full_dump="${OUTPUT_DIR}/${DB_NAME}_${ts}.dump"
counts_file="${OUTPUT_DIR}/source_counts_${ts}.tsv"

PGPASSWORD="${PASSWORD}" psql \
  -h "${HOST}" \
  -p "${PORT}" \
  -U "${USER}" \
  -d "${DB_NAME}" \
  -c "SELECT 1" >/dev/null

table_args=()
for table_name in "$@"; do
  table_args+=("-t" "${table_name}")
done

PGPASSWORD="${PASSWORD}" pg_dump \
  -h "${HOST}" \
  -p "${PORT}" \
  -U "${USER}" \
  -d "${DB_NAME}" \
  --data-only \
  --inserts \
  --column-inserts \
  "${table_args[@]}" \
  -f "${config_sql}"

PGPASSWORD="${PASSWORD}" pg_dump \
  -h "${HOST}" \
  -p "${PORT}" \
  -U "${USER}" \
  -d "${DB_NAME}" \
  -Fc \
  -f "${full_dump}"

> "${counts_file}"
for table_name in users projects assets api_providers model_configs; do
  count_value="$(PGPASSWORD="${PASSWORD}" psql \
    -h "${HOST}" \
    -p "${PORT}" \
    -U "${USER}" \
    -d "${DB_NAME}" \
    -At \
    -c "SELECT COUNT(*) FROM public.${table_name}")"
  printf '%s\t%s\n' "${table_name}" "${count_value}" >> "${counts_file}"
done

echo "CONFIG_SQL=${config_sql}"
echo "FULL_DUMP=${full_dump}"
echo "COUNTS_FILE=${counts_file}"
echo "DB_NAME=${DB_NAME}"
EOF
}

write_prod_apply_script() {
  local script_path="$1"
  cat > "${script_path}" <<'EOF'
#!/bin/bash
set -euo pipefail

MERGE_SQL="${1:-}"
FULL_DUMP="${2:-}"
COUNTS_FILE="${3:-}"
SUPERVISOR_PATH="${SUPERVISOR_PATH:-/etc/supervisord.d/miioo-backend.ini}"
FALLBACK_BACKEND_DIR="${FALLBACK_BACKEND_DIR:-/www/wwwroot/miiooaib.com/backend}"
SKIP_TARGET_MERGE="${SKIP_TARGET_MERGE:-false}"

if [ -z "${MERGE_SQL}" ] || [ -z "${FULL_DUMP}" ] || [ -z "${COUNTS_FILE}" ]; then
  echo "用法: bash apply_db_incremental_miioo.sh <merge_sql> <full_dump> <counts_file>" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

detect_active_backend_dir() {
  local detected=""
  if [ -f "${SUPERVISOR_PATH}" ]; then
    detected="$(awk -F= '/^directory=/{print $2; exit}' "${SUPERVISOR_PATH}")"
  fi
  if [ -n "${detected}" ]; then
    printf '%s' "${detected}"
  else
    printf '%s' "${FALLBACK_BACKEND_DIR}"
  fi
}

read_database_url() {
  local env_path="${1}"
  ENV_PATH="${env_path}" python3 - <<'PY'
from pathlib import Path
import os

env_path = Path(os.environ["ENV_PATH"])
if not env_path.is_file():
    raise SystemExit(f"未找到环境文件: {env_path}")

for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "DATABASE_URL":
        print(value.strip().strip('"').strip("'"))
        break
else:
    raise SystemExit(f"{env_path} 中未找到 DATABASE_URL")
PY
}

parse_db_url() {
  local db_url="$1"
  DB_URL_INPUT="$db_url" python3 - <<'PY'
from urllib.parse import urlparse
import os

db_url = os.environ["DB_URL_INPUT"].strip()
parsed = urlparse(db_url.replace("+asyncpg", ""))
if parsed.scheme != "postgresql":
    raise SystemExit(f"当前仅支持 PostgreSQL，实际为: {parsed.scheme}")

print(f"HOST={parsed.hostname or 'localhost'}")
print(f"PORT={parsed.port or 5432}")
print(f"USER={parsed.username or ''}")
print(f"PASSWORD={parsed.password or ''}")
print(f"DB_NAME={parsed.path.lstrip('/')}")
PY
}

build_restore_db_name() {
  local base_name="$1"
  local ts="$2"
  BASE_NAME="${base_name}" RESTORE_TS="${ts}" python3 - <<'PY'
import os
import re

base = os.environ["BASE_NAME"]
ts = os.environ["RESTORE_TS"]
name = f"{base}_restore_{ts}"
name = re.sub(r"[^a-zA-Z0-9_]+", "_", name)
print(name)
PY
}

build_restore_db_url() {
  local db_url="$1"
  local restore_db="$2"
  DB_URL_INPUT="${db_url}" RESTORE_DB="${restore_db}" python3 - <<'PY'
from urllib.parse import urlparse, urlunparse
import os

db_url = os.environ["DB_URL_INPUT"]
restore_db = os.environ["RESTORE_DB"]
parsed = urlparse(db_url)
path = f"/{restore_db}"
print(urlunparse(parsed._replace(path=path)))
PY
}

require_cmd python3
require_cmd pg_dump
require_cmd pg_restore
require_cmd psql

run_alembic() {
  local db_url="$1"
  shift
  (
    cd "${ACTIVE_BACKEND_DIR}"
    DATABASE_URL="${db_url}" "${ALEMBIC_BIN}" "$@"
  )
}

create_restore_db() {
  local restore_db="$1"
  su - postgres -c "psql -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE \"${restore_db}\" OWNER \"${USER}\"'"
}

ACTIVE_BACKEND_DIR="$(detect_active_backend_dir)"
ENV_PATH="${ACTIVE_BACKEND_DIR}/.env"
ALEMBIC_BIN="${ACTIVE_BACKEND_DIR}/.venv/bin/alembic"

if [ ! -d "${ACTIVE_BACKEND_DIR}" ]; then
  echo "未找到当前生产后端目录: ${ACTIVE_BACKEND_DIR}" >&2
  exit 1
fi

if [ ! -x "${ALEMBIC_BIN}" ]; then
  echo "未找到可执行的 Alembic: ${ALEMBIC_BIN}" >&2
  exit 1
fi

DATABASE_URL="$(read_database_url "${ENV_PATH}")"
eval "$(parse_db_url "${DATABASE_URL}")"

ts="$(date +%Y%m%d_%H%M%S)"
INCREMENTAL_DIR="${ACTIVE_BACKEND_DIR}/sql/incremental"
RESTORE_DIR="${ACTIVE_BACKEND_DIR}/sql/restore_backups"
mkdir -p "${INCREMENTAL_DIR}" "${RESTORE_DIR}"

target_backup=""
merge_sql_copy="${INCREMENTAL_DIR}/$(basename "${MERGE_SQL}")"
counts_copy="${INCREMENTAL_DIR}/$(basename "${COUNTS_FILE}")"
restore_dump="${RESTORE_DIR}/$(basename "${FULL_DUMP}")"

cp -f "${MERGE_SQL}" "${merge_sql_copy}"
cp -f "${COUNTS_FILE}" "${counts_copy}"
cp -f "${FULL_DUMP}" "${restore_dump}"

if [ "${SKIP_TARGET_MERGE}" != "true" ]; then
  target_backup="${INCREMENTAL_DIR}/target_backup_${DB_NAME}_${ts}.dump"

  echo "备份 129 生产库到 ${target_backup}"
  PGPASSWORD="${PASSWORD}" pg_dump \
    -h "${HOST}" \
    -p "${PORT}" \
    -U "${USER}" \
    -d "${DB_NAME}" \
    -Fc \
    -f "${target_backup}"

  echo "对 129 生产库执行 Alembic 结构迁移"
  run_alembic "${DATABASE_URL}" current
  run_alembic "${DATABASE_URL}" upgrade head
  run_alembic "${DATABASE_URL}" current

  echo "将配置类 merge SQL 导入 129 生产库"
  PGPASSWORD="${PASSWORD}" psql \
    -h "${HOST}" \
    -p "${PORT}" \
    -U "${USER}" \
    -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    -f "${merge_sql_copy}"
else
  echo "已按要求跳过目标库备份、结构迁移与配置类 merge，仅执行旁路恢复。"
fi

restore_db="$(build_restore_db_name "${DB_NAME}" "${ts}")"
restore_db_url="$(build_restore_db_url "${DATABASE_URL}" "${restore_db}")"

echo "在 129 创建旁路恢复库 ${restore_db}"
create_restore_db "${restore_db}"

echo "把 152 全库 dump 恢复到 129 旁路恢复库 ${restore_db}"
PGPASSWORD="${PASSWORD}" pg_restore \
  -h "${HOST}" \
  -p "${PORT}" \
  -U "${USER}" \
  -d "${restore_db}" \
  "${restore_dump}"

echo "对旁路恢复库执行 Alembic 结构对齐"
run_alembic "${restore_db_url}" current
run_alembic "${restore_db_url}" upgrade head
run_alembic "${restore_db_url}" current

echo "=== COUNT CHECK ==="
while IFS=$'\t' read -r table_name source_count; do
  [ -n "${table_name}" ] || continue
  restore_count="$(PGPASSWORD="${PASSWORD}" psql \
    -h "${HOST}" \
    -p "${PORT}" \
    -U "${USER}" \
    -d "${restore_db}" \
    -At \
    -c "SELECT COUNT(*) FROM public.${table_name}")"
  printf '%s\t%s\t%s\n' "${table_name}" "${source_count}" "${restore_count}"
done < "${counts_copy}"

echo "TARGET_BACKUP=${target_backup}"
echo "MERGE_SQL_COPY=${merge_sql_copy}"
echo "RESTORE_DUMP=${restore_dump}"
echo "RESTORE_DB=${restore_db}"
echo "ACTIVE_BACKEND_DIR=${ACTIVE_BACKEND_DIR}"
EOF
}

extract_value() {
  local key="$1"
  local content="$2"
  printf '%s\n' "${content}" | tr -d '\r' | awk -F= -v key="${key}" '$1==key {print substr($0, index($0,"=")+1); exit}'
}

print_help() {
  cat <<'EOF'
用途：
  从 152 导出配置类表增量 SQL 与完整数据库 dump，
  在 129 先备份并迁移生产库，再 merge 5 张配置类表，
  同时把 152 全库恢复为 129 旁路恢复库。

用法：
  TEST_REMOTE_PASSWORD='152 密码' \
  PROD_REMOTE_PASSWORD='129 密码' \
  bash backend/deploy/supervisor/sync_db_from_chengxvblog_to_miioo_incremental.sh

可覆盖环境变量：
  TEST_REMOTE_HOST=152.136.237.31
  TEST_REMOTE_USER=root
  TEST_REMOTE_BACKEND_DIR=/www/wwwroot/chengxvblog.top/backend
  PROD_REMOTE_HOST=129.211.162.176
  PROD_REMOTE_USER=root
  LOCAL_STAGE_BASE=/Users/xingyi/Desktop/tmp/db_sync_from_chengxvblog

默认行为：
  - 正式写入 129 生产库的仅有 5 张配置类表
  - 129 生产库始终先备份，再执行 alembic upgrade head
  - 152 全量业务数据只会落到 129 的 restore 临时库，不覆盖生产库
EOF
}

main() {
  if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    print_help
    exit 0
  fi

  require_cmd python3
  require_cmd ssh
  require_cmd scp
  require_cmd expect
  require_env TEST_REMOTE_PASSWORD
  require_env PROD_REMOTE_PASSWORD

  if [ ! -f "${BUILD_MERGE_SCRIPT}" ]; then
    echo "未找到 merge 生成脚本: ${BUILD_MERGE_SCRIPT}" >&2
    exit 1
  fi

  local ts run_dir remote_export_dir remote_export_output
  local remote_test_helper_local remote_prod_helper_local
  local config_sql_remote full_dump_remote counts_file_remote
  local local_config_sql local_merge_sql local_full_dump local_counts_file
  local prod_stage_dir prod_output
  local table_name

  ts="$(date +%Y%m%d_%H%M%S)"
  run_dir="${LOCAL_STAGE_BASE}/${ts}"
  remote_export_dir="/tmp/chengxv_db_sync_${ts}"
  prod_stage_dir="/tmp/miioo_db_sync_${ts}"
  remote_test_helper_local="$(mktemp)"
  remote_prod_helper_local="$(mktemp)"

  mkdir -p "${run_dir}"
  write_test_export_script "${remote_test_helper_local}"
  write_prod_apply_script "${remote_prod_helper_local}"

  echo "上传 152 数据导出脚本到 ${TEST_REMOTE_TARGET}:${TEST_REMOTE_SCRIPT_PATH}"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${remote_test_helper_local}" \
    "${TEST_REMOTE_TARGET}:${TEST_REMOTE_SCRIPT_PATH}"

  echo "在 152 导出配置类增量 SQL、完整 dump 与关键表计数"
  remote_export_output="$(run_test ssh \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}" \
    "mkdir -p '${remote_export_dir}' && bash '${TEST_REMOTE_SCRIPT_PATH}' '${TEST_REMOTE_BACKEND_DIR}' '${remote_export_dir}' $(printf "'%s' " "${CONFIG_TABLES[@]}")")"

  config_sql_remote="$(extract_value "CONFIG_SQL" "${remote_export_output}")"
  full_dump_remote="$(extract_value "FULL_DUMP" "${remote_export_output}")"
  counts_file_remote="$(extract_value "COUNTS_FILE" "${remote_export_output}")"

  if [ -z "${config_sql_remote}" ] || [ -z "${full_dump_remote}" ] || [ -z "${counts_file_remote}" ]; then
    echo "未能从 152 导出结果中解析出完整文件路径。" >&2
    printf '%s\n' "${remote_export_output}" >&2
    exit 1
  fi

  local_config_sql="${run_dir}/$(basename "${config_sql_remote}")"
  local_full_dump="${run_dir}/$(basename "${full_dump_remote}")"
  local_counts_file="${run_dir}/$(basename "${counts_file_remote}")"
  local_merge_sql="${run_dir}/$(basename "${config_sql_remote%.sql}")_merge.sql"

  echo "下载 152 导出的配置 SQL、完整 dump 与计数文件到本地"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}:${config_sql_remote}" \
    "${local_config_sql}"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}:${full_dump_remote}" \
    "${local_full_dump}"
  run_test scp \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}:${counts_file_remote}" \
    "${local_counts_file}"

  echo "清理 152 远端临时文件"
  run_test ssh \
    -o StrictHostKeyChecking=accept-new \
    "${TEST_REMOTE_TARGET}" \
    "rm -rf '${remote_export_dir}' '${TEST_REMOTE_SCRIPT_PATH}'"

  echo "在本地生成配置类 merge SQL"
  python3 "${BUILD_MERGE_SCRIPT}" "${local_config_sql}" -o "${local_merge_sql}"

  echo "创建 129 临时接收目录 ${prod_stage_dir}"
  run_prod ssh \
    -o StrictHostKeyChecking=accept-new \
    "${PROD_REMOTE_TARGET}" \
    "mkdir -p '${prod_stage_dir}'"

  echo "上传 merge SQL、完整 dump、计数文件与 129 执行脚本"
  run_prod scp \
    -o StrictHostKeyChecking=accept-new \
    "${local_merge_sql}" \
    "${local_full_dump}" \
    "${local_counts_file}" \
    "${remote_prod_helper_local}" \
    "${PROD_REMOTE_TARGET}:${prod_stage_dir}/"

  echo "在 129 执行生产库增量 merge 与旁路恢复"
  prod_output="$(run_prod ssh \
    -o StrictHostKeyChecking=accept-new \
    "${PROD_REMOTE_TARGET}" \
    "SKIP_TARGET_MERGE='${SKIP_TARGET_MERGE:-false}' bash '${prod_stage_dir}/$(basename "${remote_prod_helper_local}")' '${prod_stage_dir}/$(basename "${local_merge_sql}")' '${prod_stage_dir}/$(basename "${local_full_dump}")' '${prod_stage_dir}/$(basename "${local_counts_file}")'")"

  printf '%s\n' "${prod_output}"

  echo "清理 129 远端临时文件"
  run_prod ssh \
    -o StrictHostKeyChecking=accept-new \
    "${PROD_REMOTE_TARGET}" \
    "rm -rf '${prod_stage_dir}'"

  rm -f "${remote_test_helper_local}" "${remote_prod_helper_local}"

  echo "已完成 152 -> 129 数据库增量 merge 与旁路恢复编排"
  echo "本地中转目录: ${run_dir}"
}

main "$@"
