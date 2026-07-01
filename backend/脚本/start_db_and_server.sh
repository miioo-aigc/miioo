#!/bin/bash
set -euo pipefail

echo "=== Miioo 启动脚本 ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

source "${BACKEND_DIR}/_runtime_bootstrap.sh"

PG_DATA_DIR="${PG_DATA_DIR:-/opt/homebrew/var/postgresql@16}"
PG_PORT="${PG_PORT:-5432}"
PG_CTL_BIN="${PG_CTL_BIN:-/opt/homebrew/opt/postgresql@16/bin/pg_ctl}"
PG_LOG_FILE="${PG_LOG_FILE:-/tmp/postgresql.log}"

require_command "pg_isready"
require_command "psql"

is_live_postgres_pid() {
    local pid="${1:-}"
    [ -n "${pid}" ] || return 1
    ps -p "${pid}" -o command= 2>/dev/null | grep -Eiq 'postgres|postmaster'
}

cleanup_stale_postmaster_pid() {
    local pid_file="${PG_DATA_DIR}/postmaster.pid"
    if [ ! -f "${pid_file}" ]; then
        return
    fi

    local recorded_pid=""
    recorded_pid="$(head -n 1 "${pid_file}" 2>/dev/null | tr -d '[:space:]' || true)"

    if is_live_postgres_pid "${recorded_pid}"; then
        return
    fi

    echo "  ! 检测到陈旧的 postmaster.pid（PID=${recorded_pid:-unknown}），正在清理后重试..."
    rm -f "${pid_file}"
}

if [ ! -f .env ]; then
    echo "  ✗ 未检测到 backend/.env，请先补齐数据库配置"
    exit 1
fi

DB_URL="$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- || true)"
if [ -z "${DB_URL}" ]; then
    echo "  ✗ 未在 backend/.env 中检测到 DATABASE_URL"
    exit 1
fi

PSQL_DB_URL="$(normalize_database_url_for_psql "${DB_URL}")"

echo "[1/3] 检查 PostgreSQL 服务..."
if pg_isready -q -p "${PG_PORT}" 2>/dev/null; then
    echo "  ✓ PostgreSQL 已在运行"
else
    if [ ! -x "${PG_CTL_BIN}" ]; then
        echo "  ✗ 未检测到 pg_ctl：${PG_CTL_BIN}"
        echo "  ✗ 如需覆盖路径，可显式传入 PG_CTL_BIN=/path/to/pg_ctl"
        exit 1
    fi

    cleanup_stale_postmaster_pid
    echo "  → 启动 PostgreSQL..."
    "${PG_CTL_BIN}" -D "${PG_DATA_DIR}" start -l "${PG_LOG_FILE}"
    sleep 2
    if pg_isready -q -p "${PG_PORT}" 2>/dev/null; then
        echo "  ✓ PostgreSQL 启动成功"
    else
        echo "  ✗ PostgreSQL 启动失败，请检查日志: ${PG_LOG_FILE}"
        exit 1
    fi
fi

echo "[2/3] 验证数据库连接..."
if psql "${PSQL_DB_URL}" -c "SELECT 1" >/dev/null 2>&1; then
    echo "  ✓ 数据库连接正常"
else
    echo "  ✗ 数据库连接失败，请检查数据库是否创建"
    exit 1
fi

echo "[3/3] 启动后端服务..."
ensure_backend_runtime
ensure_local_database_migrations
echo "  → 后端服务启动中 (http://localhost:8000)..."
run_uvicorn_with_reload_policy "app.main:app" "0.0.0.0" "8000" "./start_db_and_server.sh"
