#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

BACKEND_DEV_RELOAD="${BACKEND_DEV_RELOAD:-on}"
source "${BACKEND_DIR}/_runtime_bootstrap.sh"

ensure_backend_runtime
run_uvicorn_with_reload_policy "app.main:app" "0.0.0.0" "8000" "./start_线上.sh"
