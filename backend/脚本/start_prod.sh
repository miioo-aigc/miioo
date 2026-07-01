#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROD_VENV_DIR="${PROD_VENV_DIR:-${ONLINE_VENV_DIR:-/www/wwwroot/miiooaib.com/backend/.venv}}"
VENV_DIR="${VENV_DIR:-${PROD_VENV_DIR}}"
STRICT_VENV="${STRICT_VENV:-1}"

source "${BACKEND_DIR}/_runtime_bootstrap.sh"

WORKERS="${WORKERS:-4}"
APP_ENV="${APP_ENV:-production}"
BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE:-queue}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"

ensure_backend_runtime

echo "当前以后端生产模式启动（VENV_DIR=${VENV_DIR}，WORKERS=${WORKERS}，APP_ENV=${APP_ENV}，BACKGROUND_JOB_EXECUTION_MODE=${BACKGROUND_JOB_EXECUTION_MODE}）..."

exec env APP_ENV="${APP_ENV}" BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE}" \
  "${VENV_PYTHON}" -m uvicorn app.main:app \
  --host "${HOST}" \
  --port "${PORT}" \
  --proxy-headers \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS}" \
  --workers "${WORKERS}"
