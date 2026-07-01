#!/bin/bash
set -euo pipefail

REMOTE_ROOT="/www/wwwroot/miiooaib.com"
LIVE_BACKEND_DIR="${REMOTE_ROOT}/backend"
BACKUP_DIR="${REMOTE_ROOT}/deploy_backups"
SUPERVISOR_PATH="/etc/supervisord.d/miioo-backend.ini"
SUPERVISOR_BACKUP_PATH="${1:-}"
BACKEND_FULL_BACKUP_PATH="${2:-}"

if [ -z "${SUPERVISOR_BACKUP_PATH}" ]; then
  echo "用法: bash rollback_backend_release_remote.sh <supervisor_backup_path> [backend_full_backup_path]" >&2
  exit 1
fi

if [ ! -f "${SUPERVISOR_BACKUP_PATH}" ]; then
  echo "未找到 Supervisor 备份文件: ${SUPERVISOR_BACKUP_PATH}" >&2
  exit 1
fi

if [ -n "${BACKEND_FULL_BACKUP_PATH}" ] && [ ! -f "${BACKEND_FULL_BACKUP_PATH}" ]; then
  echo "未找到 backend 完整备份包: ${BACKEND_FULL_BACKUP_PATH}" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

current_service_names() {
  supervisorctl status | awk '/^miioo-web|^miioo-worker/ {print $1}' | paste -sd' ' -
}

wait_for_docs_ready() {
  local attempts=30
  local index

  for ((index = 1; index <= attempts; index += 1)); do
    if curl -I -s http://127.0.0.1:8000/docs | grep -q '200'; then
      return 0
    fi
    sleep 2
  done

  return 1
}

require_cmd supervisorctl
require_cmd curl

ts="$(date +%Y%m%d_%H%M%S)"
CURRENT_SUPERVISOR_SNAPSHOT="${BACKUP_DIR}/miioo-backend.ini.rollback_current_${ts}"

mkdir -p "${BACKUP_DIR}"

echo "先备份当前 Supervisor 配置到 ${CURRENT_SUPERVISOR_SNAPSHOT}"
cp -f "${SUPERVISOR_PATH}" "${CURRENT_SUPERVISOR_SNAPSHOT}"

if [ -n "${BACKEND_FULL_BACKUP_PATH}" ]; then
  require_cmd tar
  CURRENT_BACKEND_SNAPSHOT="${BACKUP_DIR}/backend_before_rollback_${ts}.tgz"
  echo "先备份当前 backend 到 ${CURRENT_BACKEND_SNAPSHOT}"
  tar -czf "${CURRENT_BACKEND_SNAPSHOT}" -C "${REMOTE_ROOT}" backend

  STASH_DIR="${REMOTE_ROOT}/backend.rollback_stash_${ts}"
  echo "暂存当前 backend 目录到 ${STASH_DIR}"
  mv "${LIVE_BACKEND_DIR}" "${STASH_DIR}"

  echo "从 ${BACKEND_FULL_BACKUP_PATH} 还原 backend 目录"
  tar -xzf "${BACKEND_FULL_BACKUP_PATH}" -C "${REMOTE_ROOT}"
  chown -R www:www "${LIVE_BACKEND_DIR}"
fi

echo "恢复 Supervisor 配置 ${SUPERVISOR_BACKUP_PATH}"
cp -f "${SUPERVISOR_BACKUP_PATH}" "${SUPERVISOR_PATH}"

supervisorctl reread
supervisorctl update

NAMES="$(current_service_names)"
if [ -n "${NAMES}" ]; then
  supervisorctl restart ${NAMES}
fi

if ! wait_for_docs_ready; then
  echo "回滚后 /docs 未在预期时间内返回 200" >&2
  exit 1
fi

echo "=== STATUS ==="
supervisorctl status
echo "=== DOCS ==="
curl -I -s http://127.0.0.1:8000/docs | head -n 5
echo "=== PUBLIC DOCS ==="
curl -I -s https://www.miiooai.com/docs | head -n 5
echo "=== RESTORED SUPERVISOR ==="
echo "${SUPERVISOR_BACKUP_PATH}"
if [ -n "${BACKEND_FULL_BACKUP_PATH}" ]; then
  echo "=== RESTORED BACKEND ARCHIVE ==="
  echo "${BACKEND_FULL_BACKUP_PATH}"
fi
