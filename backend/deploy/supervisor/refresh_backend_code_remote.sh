#!/bin/bash
set -euo pipefail

REMOTE_ROOT="/www/wwwroot/miiooaib.com"
BACKEND_DIR="${REMOTE_ROOT}/backend"
BACKUP_DIR="${REMOTE_ROOT}/deploy_backups"
ARCHIVE_NAME="${1:-}"
PYTHON_BIN="/usr/bin/python3"

if [ -z "${ARCHIVE_NAME}" ]; then
  echo "用法: bash refresh_backend_code_remote.sh <archive_name>" >&2
  exit 1
fi

ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "未找到代码包: ${ARCHIVE_PATH}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
ts="$(date +%Y%m%d_%H%M%S)"

backup_items=(
  "backend/app"
  "backend/alembic"
  "backend/deploy"
  "backend/nginx"
  "backend/scripts"
  "backend/脚本"
  "backend/_runtime_bootstrap.sh"
  "backend/alembic.ini"
  "backend/requirements.txt"
  "backend/start.sh"
  "backend/start_public.sh"
  "backend/start_worker.sh"
  "backend/stop_public_tunnel.sh"
  "backend/tunnel.sh"
  "backend/BACKEND_API_DOC.md"
  "backend/.env.example"
)

existing_items=()
for item in "${backup_items[@]}"; do
  if [ -e "${REMOTE_ROOT}/${item}" ]; then
    existing_items+=("${item}")
  fi
done

if [ "${#existing_items[@]}" -gt 0 ]; then
  tar -czf "${BACKUP_DIR}/backend_code_before_${ts}.tgz" \
    -C "${REMOTE_ROOT}" \
    "${existing_items[@]}"
fi

replace_paths=(
  "${BACKEND_DIR}/app"
  "${BACKEND_DIR}/alembic"
  "${BACKEND_DIR}/deploy"
  "${BACKEND_DIR}/nginx"
  "${BACKEND_DIR}/scripts"
  "${BACKEND_DIR}/脚本"
  "${BACKEND_DIR}/_runtime_bootstrap.sh"
  "${BACKEND_DIR}/alembic.ini"
  "${BACKEND_DIR}/requirements.txt"
  "${BACKEND_DIR}/start.sh"
  "${BACKEND_DIR}/start_public.sh"
  "${BACKEND_DIR}/start_worker.sh"
  "${BACKEND_DIR}/stop_public_tunnel.sh"
  "${BACKEND_DIR}/tunnel.sh"
  "${BACKEND_DIR}/BACKEND_API_DOC.md"
  "${BACKEND_DIR}/.env.example"
)

for path in "${replace_paths[@]}"; do
  rm -rf "${path}"
done

tar -xzf "${ARCHIVE_PATH}" -C "${REMOTE_ROOT}"
chown -R www:www "${BACKEND_DIR}"

# 确保 .venv 可用，不存在则重建
if [ ! -x "${BACKEND_DIR}/.venv/bin/python" ]; then
  echo "虚拟环境不可用，重建 .venv ..."
  rm -rf "${BACKEND_DIR}/.venv"
  "${PYTHON_BIN}" -m venv "${BACKEND_DIR}/.venv"
  chown -R www:www "${BACKEND_DIR}/.venv"
fi

cd "${BACKEND_DIR}"
"${BACKEND_DIR}/.venv/bin/python" -m pip install --upgrade pip
"${BACKEND_DIR}/.venv/bin/python" -m pip install -r requirements.txt

# 加载 .env 环境变量后再执行 alembic
if [ -f "${BACKEND_DIR}/.env" ]; then
  set -a
  source "${BACKEND_DIR}/.env"
  set +a
  "${BACKEND_DIR}/.venv/bin/python" -m alembic upgrade head
else
  echo "警告: 未找到 .env 文件，跳过 alembic 迁移" >&2
fi

# 清理残留的前端 Supervisor 配置（避免阻塞后端进程管理）
STALE_FRONTEND_CONF="/etc/supervisord.d/miioo-frontend.ini"
if [ -f "${STALE_FRONTEND_CONF}" ]; then
  echo "检测到残留前端 Supervisor 配置，暂时移走: ${STALE_FRONTEND_CONF}"
  mv "${STALE_FRONTEND_CONF}" "${STALE_FRONTEND_CONF}.bak_$(date +%Y%m%d_%H%M%S)"
  supervisorctl reread || true
fi

supervisorctl update || true

# 只重启后端进程
names="$(supervisorctl status 2>/dev/null | awk '/^miioo-web|^miioo-worker/ {print $1}' | paste -sd' ' -)"
if [ -n "${names}" ]; then
  supervisorctl restart ${names}
fi

echo "=== STATUS ==="
supervisorctl status
echo "=== MEDIA MODE ==="
grep -E '^MEDIA_STORAGE_MODE=' "${BACKEND_DIR}/.env" || true
echo "=== DOCS ==="
curl -I -s http://127.0.0.1:8000/docs | head -n 5
echo "=== HEALTH CHECK ==="
curl -s --max-time 10 "https://www.miiooai.com/media/origin/miioo-1435336579/raw/health-check.txt" | head -n 2 || true
