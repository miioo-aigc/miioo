#!/bin/bash
set -euo pipefail

PROD_VENV_DIR="${PROD_VENV_DIR:-${ONLINE_VENV_DIR:-/www/wwwroot/miiooaib.com/backend/.venv}}"
VENV_DIR="${VENV_DIR:-${PROD_VENV_DIR}}"
STRICT_VENV="${STRICT_VENV:-1}"

source "$(dirname "$0")/_runtime_bootstrap.sh"

APP_ENV="${APP_ENV:-production}"
BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE:-queue}"

ensure_backend_runtime

echo "当前以后端 Worker 模式启动（VENV_DIR=${VENV_DIR}，APP_ENV=${APP_ENV}，BACKGROUND_JOB_EXECUTION_MODE=${BACKGROUND_JOB_EXECUTION_MODE}）..."

exec env APP_ENV="${APP_ENV}" BACKGROUND_JOB_EXECUTION_MODE="${BACKGROUND_JOB_EXECUTION_MODE}" \
  "${VENV_PYTHON}" -m app.workers.background_worker
