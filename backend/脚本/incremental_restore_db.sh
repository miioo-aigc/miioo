#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$BACKEND_DIR/sql/incremental"

mkdir -p "$OUTPUT_DIR"
cd "$BACKEND_DIR"

read_dotenv_database_url() {
    if [ ! -f ".env" ]; then
        return 0
    fi

    python3 - <<'PY'
from pathlib import Path

env_path = Path(".env")
for raw_line in env_path.read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "DATABASE_URL":
        print(value.strip().strip('"').strip("'"))
        break
PY
}

DEFAULT_DATABASE_URL="$(read_dotenv_database_url)"

SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${DATABASE_URL:-${DEFAULT_DATABASE_URL:-}}}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:-${DEFAULT_DATABASE_URL:-}}}"

print_help() {
    cat <<'EOF'
用法：
  ./脚本/incremental_restore_db.sh plan
  ./脚本/incremental_restore_db.sh backup-target
  ./脚本/incremental_restore_db.sh migrate-target
  ./脚本/incremental_restore_db.sh export-data -t public.table1 [-t public.table2 ...]
  ./脚本/incremental_restore_db.sh build-merge -f backend/sql/incremental/your_file.sql [-o backend/sql/incremental/your_file_merge.sql]
  ./脚本/incremental_restore_db.sh apply-data -f backend/sql/incremental/your_file.sql

默认行为：
  - 若未显式传入 SOURCE_DATABASE_URL / TARGET_DATABASE_URL，则默认读取 backend/.env 中的 DATABASE_URL
  - 只做“目标库备份、Alembic 迁移、指定表数据导出、增量 SQL 导入”
  - 默认拒绝导入包含 CREATE / ALTER / DROP 等 DDL 的 SQL 文件，避免误把全量快照当增量补丁执行

可用子命令：
  plan            输出推荐执行顺序
  backup-target   备份目标数据库为 pg_dump 自定义格式
  migrate-target  对目标数据库执行 alembic upgrade head
  export-data     从源数据库导出指定表的数据 SQL（data-only）
  build-merge     将标准 INSERT 增量 SQL 转为可重复执行的 merge SQL
  apply-data      将增量 SQL 导入目标数据库

常用环境变量：
  SOURCE_DATABASE_URL   导出源库连接串
  TARGET_DATABASE_URL   目标库连接串

示例：
  ./脚本/incremental_restore_db.sh backup-target
  ./脚本/incremental_restore_db.sh migrate-target
  ./脚本/incremental_restore_db.sh export-data -t public.api_providers -t public.model_configs
  ./脚本/incremental_restore_db.sh build-merge -f backend/sql/incremental/incremental_api_providers_model_configs_xxx.sql
  ./脚本/incremental_restore_db.sh apply-data -f backend/sql/incremental/incremental_api_providers_model_configs_xxx.sql
EOF
}

require_cmd() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "缺少命令: $command_name" >&2
        exit 1
    fi
}

parse_db_url() {
    local db_url="$1"
    DB_URL_INPUT="$db_url" python3 - <<'PY'
from urllib.parse import urlparse
import os

db_url = os.environ["DB_URL_INPUT"].strip()
if not db_url:
    raise SystemExit("数据库连接串为空")

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

load_source_db() {
    if [ -z "$SOURCE_DATABASE_URL" ]; then
        echo "未配置 SOURCE_DATABASE_URL，且 backend/.env 中也未读取到 DATABASE_URL。" >&2
        exit 1
    fi
    eval "$(parse_db_url "$SOURCE_DATABASE_URL")"
    SOURCE_HOST="$HOST"
    SOURCE_PORT="$PORT"
    SOURCE_USER="$USER"
    SOURCE_PASSWORD="$PASSWORD"
    SOURCE_DB_NAME="$DB_NAME"
}

load_target_db() {
    if [ -z "$TARGET_DATABASE_URL" ]; then
        echo "未配置 TARGET_DATABASE_URL，且 backend/.env 中也未读取到 DATABASE_URL。" >&2
        exit 1
    fi
    eval "$(parse_db_url "$TARGET_DATABASE_URL")"
    TARGET_HOST="$HOST"
    TARGET_PORT="$PORT"
    TARGET_USER="$USER"
    TARGET_PASSWORD="$PASSWORD"
    TARGET_DB_NAME="$DB_NAME"
}

assert_connection() {
    local password="$1"
    local host="$2"
    local port="$3"
    local user="$4"
    local db_name="$5"

    if ! PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db_name" -c "SELECT 1" >/dev/null 2>&1; then
        echo "数据库连接失败：$user@$host:$port/$db_name" >&2
        exit 1
    fi
}

command_plan() {
    cat <<'EOF'
推荐顺序：

1. 备份目标库
   ./脚本/incremental_restore_db.sh backup-target

2. 先补结构
   ./脚本/incremental_restore_db.sh migrate-target

3. 导出你要补的数据表
   ./脚本/incremental_restore_db.sh export-data -t public.api_providers -t public.model_configs

4. 若目标库已存在同主键/唯一键记录，先生成 merge SQL
   ./脚本/incremental_restore_db.sh build-merge -f backend/sql/incremental/xxx.sql

5. 将增量 SQL 导入目标库
   ./脚本/incremental_restore_db.sh apply-data -f backend/sql/incremental/xxx.sql

注意：
- 本脚本不执行整库覆盖
- apply-data 默认拒绝危险 DDL；仅对 `_staging_` 临时表 merge SQL 自动放行
- 若目标库已有同主键/唯一键数据，直接导入原始 INSERT 可能报冲突，这类场景建议先 build-merge
EOF
}

is_safe_temp_merge_sql() {
    local input_file="$1"
    SQL_FILE_PATH="$input_file" python3 - <<'PY'
from pathlib import Path
import os
import re
import sys

path = Path(os.environ["SQL_FILE_PATH"])
ddl_re = re.compile(r"^\s*(CREATE|ALTER|DROP)\s+(TABLE|SCHEMA|INDEX|TYPE|EXTENSION)\b", re.IGNORECASE)
safe_create_re = re.compile(r"^\s*CREATE\s+TEMP\s+TABLE\s+_staging_[a-zA-Z0-9_]+\s*\(", re.IGNORECASE)

for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line:
        continue
    if not ddl_re.search(line):
        continue
    if safe_create_re.search(line):
        continue
    sys.exit(1)

print("safe")
PY
}

command_backup_target() {
    require_cmd pg_dump
    require_cmd psql
    load_target_db
    assert_connection "$TARGET_PASSWORD" "$TARGET_HOST" "$TARGET_PORT" "$TARGET_USER" "$TARGET_DB_NAME"

    local timestamp
    timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
    local output_file="$OUTPUT_DIR/target_backup_${TARGET_DB_NAME}_${timestamp}.dump"

    echo "开始备份目标数据库..."
    echo "目标库: $TARGET_DB_NAME@$TARGET_HOST:$TARGET_PORT"

    PGPASSWORD="$TARGET_PASSWORD" pg_dump \
        -h "$TARGET_HOST" \
        -p "$TARGET_PORT" \
        -U "$TARGET_USER" \
        -d "$TARGET_DB_NAME" \
        -Fc \
        -f "$output_file"

    echo "备份完成：$output_file"
}

command_migrate_target() {
    require_cmd python3
    load_target_db

    if [ -d ".venv" ]; then
        # shellcheck disable=SC1091
        source ".venv/bin/activate"
    fi

    require_cmd alembic

    echo "开始对目标数据库执行 Alembic 迁移..."
    echo "目标库: $TARGET_DB_NAME@$TARGET_HOST:$TARGET_PORT"

    DATABASE_URL="$TARGET_DATABASE_URL" alembic current
    DATABASE_URL="$TARGET_DATABASE_URL" alembic upgrade head
    DATABASE_URL="$TARGET_DATABASE_URL" alembic current
}

command_export_data() {
    require_cmd pg_dump
    require_cmd psql
    load_source_db
    assert_connection "$SOURCE_PASSWORD" "$SOURCE_HOST" "$SOURCE_PORT" "$SOURCE_USER" "$SOURCE_DB_NAME"

    local tables=()
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -t|--table)
                if [ "$#" -lt 2 ]; then
                    echo "参数 $1 缺少表名。" >&2
                    exit 1
                fi
                tables+=("$2")
                shift 2
                ;;
            *)
                echo "不支持的参数: $1" >&2
                exit 1
                ;;
        esac
    done

    if [ "${#tables[@]}" -eq 0 ]; then
        echo "请至少传入一个 -t/--table，例如：-t public.api_providers" >&2
        exit 1
    fi

    local table_tag
    table_tag="$(printf '%s\n' "${tables[@]}" | sed 's/^public\.//' | paste -sd '_' -)"
    local timestamp
    timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
    local output_file="$OUTPUT_DIR/incremental_${table_tag}_${timestamp}.sql"

    local table_args=()
    local table_name
    for table_name in "${tables[@]}"; do
        table_args+=("-t" "$table_name")
    done

    echo "开始导出指定表数据..."
    echo "源库: $SOURCE_DB_NAME@$SOURCE_HOST:$SOURCE_PORT"
    echo "表: ${tables[*]}"

    PGPASSWORD="$SOURCE_PASSWORD" pg_dump \
        -h "$SOURCE_HOST" \
        -p "$SOURCE_PORT" \
        -U "$SOURCE_USER" \
        -d "$SOURCE_DB_NAME" \
        --data-only \
        --inserts \
        --column-inserts \
        "${table_args[@]}" \
        -f "$output_file"

    echo "导出完成：$output_file"
}

command_build_merge() {
    require_cmd python3

    local input_file=""
    local output_file=""

    while [ "$#" -gt 0 ]; do
        case "$1" in
            -f|--file)
                if [ "$#" -lt 2 ]; then
                    echo "参数 $1 缺少文件路径。" >&2
                    exit 1
                fi
                input_file="$2"
                shift 2
                ;;
            -o|--output)
                if [ "$#" -lt 2 ]; then
                    echo "参数 $1 缺少输出路径。" >&2
                    exit 1
                fi
                output_file="$2"
                shift 2
                ;;
            *)
                echo "不支持的参数: $1" >&2
                exit 1
                ;;
        esac
    done

    if [ -z "$input_file" ]; then
        echo "请通过 -f/--file 指定原始增量 SQL 文件。" >&2
        exit 1
    fi

    if [ ! -f "$input_file" ]; then
        echo "文件不存在：$input_file" >&2
        exit 1
    fi

    local build_script="$BACKEND_DIR/脚本/build_incremental_merge_sql.py"
    if [ ! -f "$build_script" ]; then
        echo "转换脚本不存在：$build_script" >&2
        exit 1
    fi

    echo "开始生成 merge SQL..."
    echo "原始文件: $input_file"

    if [ -n "$output_file" ]; then
        python3 "$build_script" "$input_file" -o "$output_file"
    else
        python3 "$build_script" "$input_file"
    fi
}

command_apply_data() {
    require_cmd psql
    load_target_db
    assert_connection "$TARGET_PASSWORD" "$TARGET_HOST" "$TARGET_PORT" "$TARGET_USER" "$TARGET_DB_NAME"

    local input_file=""
    local allow_ddl=0

    while [ "$#" -gt 0 ]; do
        case "$1" in
            -f|--file)
                if [ "$#" -lt 2 ]; then
                    echo "参数 $1 缺少文件路径。" >&2
                    exit 1
                fi
                input_file="$2"
                shift 2
                ;;
            --allow-ddl)
                allow_ddl=1
                shift
                ;;
            *)
                echo "不支持的参数: $1" >&2
                exit 1
                ;;
        esac
    done

    if [ -z "$input_file" ]; then
        echo "请通过 -f/--file 指定要导入的 SQL 文件。" >&2
        exit 1
    fi

    if [ ! -f "$input_file" ]; then
        echo "文件不存在：$input_file" >&2
        exit 1
    fi

    if [ "$allow_ddl" -ne 1 ]; then
        if grep -Eiq '^[[:space:]]*(CREATE|ALTER|DROP)[[:space:]]+(TABLE|SCHEMA|INDEX|TYPE|EXTENSION)\b' "$input_file"; then
            if ! is_safe_temp_merge_sql "$input_file" >/dev/null 2>&1; then
                echo "检测到 DDL 语句，默认拒绝执行：$input_file" >&2
                echo "如确认该文件是安全的增量补丁，请手工检查后追加 --allow-ddl。" >&2
                exit 1
            fi
        fi
    fi

    echo "开始导入增量 SQL..."
    echo "目标库: $TARGET_DB_NAME@$TARGET_HOST:$TARGET_PORT"
    echo "文件: $input_file"

    PGPASSWORD="$TARGET_PASSWORD" psql \
        -h "$TARGET_HOST" \
        -p "$TARGET_PORT" \
        -U "$TARGET_USER" \
        -d "$TARGET_DB_NAME" \
        -v ON_ERROR_STOP=1 \
        -f "$input_file"

    echo "导入完成。"
}

main() {
    local command="${1:-help}"
    if [ "$#" -gt 0 ]; then
        shift
    fi

    case "$command" in
        plan)
            command_plan
            ;;
        backup-target)
            command_backup_target "$@"
            ;;
        migrate-target)
            command_migrate_target "$@"
            ;;
        export-data)
            command_export_data "$@"
            ;;
        build-merge)
            command_build_merge "$@"
            ;;
        apply-data)
            command_apply_data "$@"
            ;;
        -h|--help|help)
            print_help
            ;;
        *)
            echo "不支持的子命令: $command" >&2
            echo >&2
            print_help
            exit 1
            ;;
    esac
}

main "$@"
