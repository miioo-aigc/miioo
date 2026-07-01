#!/bin/bash
set -euo pipefail

REMOTE_ROOT="${REMOTE_ROOT:-/www/wwwroot/miiooaib.com}"
RELEASES_DIR="${RELEASES_DIR:-${REMOTE_ROOT}/frontend_new_releases}"
BACKUP_DIR="${BACKUP_DIR:-${REMOTE_ROOT}/deploy_backups}"
ARCHIVE_NAME="${1:-}"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
SOURCE_LABEL="${SOURCE_LABEL:-unknown}"

if [ -z "${ARCHIVE_NAME}" ]; then
  echo "用法: bash refresh_frontend_new_code_remote_miioo.sh <archive_name>" >&2
  exit 1
fi

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "未找到前端代码包: ${ARCHIVE_PATH}" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_cmd tar

mkdir -p "${RELEASES_DIR}" "${BACKUP_DIR}"
ts="$(date +%Y%m%d_%H%M%S)"
RELEASE_ROOT="${RELEASES_DIR}/${ts}"
RELEASE_FRONTEND_DIR="${RELEASE_ROOT}/frontend_new"
RELEASE_META_PATH="${RELEASE_ROOT}/sync_meta.env"

echo "本轮仅执行 frontend_new 代码落包，不会修改 Nginx / CDN / Supervisor"
mkdir -p "${RELEASE_ROOT}"

echo "解压前端代码到 ${RELEASE_FRONTEND_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_ROOT}"

if [ ! -d "${RELEASE_FRONTEND_DIR}/src" ] || [ ! -f "${RELEASE_FRONTEND_DIR}/package.json" ]; then
  echo "新目录缺少 src/ 或 package.json，解压结果异常: ${RELEASE_FRONTEND_DIR}" >&2
  exit 1
fi

cat > "${RELEASE_META_PATH}" <<EOF
SYNC_TIMESTAMP=${ts}
SOURCE_LABEL=${SOURCE_LABEL}
ARCHIVE_NAME=${ARCHIVE_NAME}
RELEASE_ROOT=${RELEASE_ROOT}
RELEASE_FRONTEND_DIR=${RELEASE_FRONTEND_DIR}
EOF

rm -f "${ARCHIVE_PATH}"

echo "=== FRONTEND_NEW STAGED RELEASE ==="
echo "${RELEASE_FRONTEND_DIR}"
echo "=== SYNC META ==="
echo "${RELEASE_META_PATH}"
echo "=== GUARANTEES ==="
echo "NO_NGINX_CHANGES=1"
echo "NO_CDN_CHANGES=1"
echo "NO_SUPERVISOR_CHANGES=1"
