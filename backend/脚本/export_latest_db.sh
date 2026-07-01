#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$BACKEND_DIR/sql"

mkdir -p "$OUTPUT_DIR"
cd "$BACKEND_DIR"

EXPORT_FULL=1
ALLOW_OUTDATED_EXPORT=0

for arg in "$@"; do
    case "$arg" in
        --schema-only)
            EXPORT_FULL=0
            ;;
        --with-full)
            EXPORT_FULL=1
            ;;
        --allow-outdated)
            ALLOW_OUTDATED_EXPORT=1
            ;;
        -h|--help)
            cat <<'EOF'
用法：
  ./export_latest_db.sh
  ./export_latest_db.sh --schema-only
  ./export_latest_db.sh --allow-outdated

默认行为：
  - 校验当前数据库是否已追上最新 alembic heads
  - 导出最新 schema SQL
  - 额外导出 full dump 备份

可选参数：
  --schema-only     仅导出 schema SQL，不导出 full dump
  --with-full       显式导出 schema + full dump（默认）
  --allow-outdated  当前数据库未追上最新 heads 时也继续导出
EOF
            exit 0
            ;;
        *)
            echo "不支持的参数: $arg" >&2
            exit 1
            ;;
    esac
done

if [ ! -f ".env" ]; then
    echo "未找到 backend/.env，请先在 backend 目录配置数据库连接。" >&2
    exit 1
fi

if [ -d ".venv" ]; then
    # 复用项目虚拟环境，确保 alembic 命令口径与当前项目一致。
    # shellcheck disable=SC1091
    source .venv/bin/activate
fi

for cmd in python3 psql pg_dump; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "缺少命令: $cmd" >&2
        exit 1
    fi
done

if ! command -v alembic >/dev/null 2>&1; then
    echo "缺少命令: alembic，请先安装后端依赖或创建 .venv。" >&2
    exit 1
fi

DB_INFO="$(
python3 - <<'PY'
from pathlib import Path
from urllib.parse import urlparse

env_path = Path(".env")
values = {}
for raw_line in env_path.read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    values[key.strip()] = value.strip().strip('"').strip("'")

database_url = values.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL 未配置")

parsed = urlparse(database_url.replace("+asyncpg", ""))
if parsed.scheme != "postgresql":
    raise SystemExit(f"当前仅支持 PostgreSQL，实际为: {parsed.scheme}")

print(f"HOST={parsed.hostname or 'localhost'}")
print(f"PORT={parsed.port or 5432}")
print(f"USER={parsed.username or ''}")
print(f"PASSWORD={parsed.password or ''}")
print(f"DB_NAME={parsed.path.lstrip('/')}")
PY
)"

eval "$DB_INFO"

echo "=== Miioo 数据库导出脚本 ==="
echo "数据库: $DB_NAME@$HOST:$PORT"

if ! PGPASSWORD="$PASSWORD" psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    echo "数据库连接失败，请检查 .env 中的 DATABASE_URL。" >&2
    exit 1
fi

HEAD_REVISIONS="$(alembic heads | awk '/^[0-9a-z]+/ {print $1}' | sort | paste -sd ',' -)"
CURRENT_REVISIONS="$(alembic current | awk '/^[0-9a-z]+/ {print $1}' | sort | paste -sd ',' -)"

if [ -z "$HEAD_REVISIONS" ]; then
    echo "未读取到 alembic heads，无法判断是否为最新库。" >&2
    exit 1
fi

if [ -z "$CURRENT_REVISIONS" ]; then
    echo "未读取到 alembic current，无法判断当前数据库版本。" >&2
    exit 1
fi

if [ "$CURRENT_REVISIONS" != "$HEAD_REVISIONS" ]; then
    echo "当前数据库未追上最新迁移：" >&2
    echo "  current: $CURRENT_REVISIONS" >&2
    echo "  heads:   $HEAD_REVISIONS" >&2
    if [ "$ALLOW_OUTDATED_EXPORT" -ne 1 ]; then
        echo "如需强制导出当前库，请追加 --allow-outdated。" >&2
        exit 1
    fi
fi

REVISION_TAG="heads_$(echo "$HEAD_REVISIONS" | tr ',' '_')"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
SCHEMA_FILE="$OUTPUT_DIR/miioo_pgsql_schema_${REVISION_TAG}_${TIMESTAMP}.sql"
FULL_FILE="$OUTPUT_DIR/miioo_pgsql_full_${REVISION_TAG}_${TIMESTAMP}.sql"

echo "[1/2] 导出 schema SQL..."
PGPASSWORD="$PASSWORD" pg_dump \
    -h "$HOST" \
    -p "$PORT" \
    -U "$USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --schema-only \
    -f "$SCHEMA_FILE"

TABLE_COUNT="$(grep -c '^CREATE TABLE ' "$SCHEMA_FILE" || true)"
echo "  ✓ schema 导出完成"
echo "  → 文件: $SCHEMA_FILE"
echo "  → CREATE TABLE 数量: $TABLE_COUNT"

if [ "$EXPORT_FULL" -eq 1 ]; then
    echo "[2/2] 导出 full dump..."
    PGPASSWORD="$PASSWORD" pg_dump \
        -h "$HOST" \
        -p "$PORT" \
        -U "$USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        -f "$FULL_FILE"
    echo "  ✓ full dump 导出完成"
    echo "  → 文件: $FULL_FILE"
else
    echo "[2/2] 已跳过 full dump（--schema-only）"
fi

echo "导出完成。"
