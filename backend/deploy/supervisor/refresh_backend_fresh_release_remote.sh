#!/bin/bash
set -euo pipefail

REMOTE_ROOT="/www/wwwroot/miiooaib.com"
LIVE_BACKEND_DIR="${REMOTE_ROOT}/backend"
RELEASES_DIR="${REMOTE_ROOT}/backend_releases"
BACKUP_DIR="${REMOTE_ROOT}/deploy_backups"
SUPERVISOR_PATH="/etc/supervisord.d/miioo-backend.ini"
ARCHIVE_NAME="${1:-}"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"

if [ -z "${ARCHIVE_NAME}" ]; then
  echo "用法: bash refresh_backend_fresh_release_remote.sh <archive_name>" >&2
  exit 1
fi

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "未找到代码包: ${ARCHIVE_PATH}" >&2
  exit 1
fi

if [ ! -d "${LIVE_BACKEND_DIR}" ]; then
  echo "未找到当前线上后端目录: ${LIVE_BACKEND_DIR}" >&2
  exit 1
fi

if [ ! -f "${SUPERVISOR_PATH}" ]; then
  echo "未找到当前 Supervisor 配置: ${SUPERVISOR_PATH}" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

pick_python_bin() {
  local candidate
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      printf '%s' "${candidate}"
      return
    fi
  done

  echo "未检测到可用的 Python 3 可执行文件" >&2
  exit 1
}

update_supervisor_config() {
  local source_path="$1"
  local target_path="$2"
  local release_backend_dir="$3"

  RELEASE_BACKEND_DIR="${release_backend_dir}" \
  python3 - "${source_path}" "${target_path}" <<'PY'
from pathlib import Path
import os
import re
import sys

source_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
release_backend_dir = os.environ["RELEASE_BACKEND_DIR"]
release_venv_dir = f"{release_backend_dir}/.venv"
web_log = f"{release_backend_dir}/logs/supervisor/web.log"
worker_log = f"{release_backend_dir}/logs/supervisor/worker.log"

section = ""
lines = []
for raw_line in source_path.read_text(encoding="utf-8").splitlines():
    line = raw_line
    stripped = line.strip()
    if stripped.startswith("[program:") and stripped.endswith("]"):
      section = stripped[len("[program:"):-1]
    if line.startswith("directory="):
      line = f"directory={release_backend_dir}"
    elif line.startswith("stdout_logfile="):
      if section == "miioo-web":
        line = f"stdout_logfile={web_log}"
      elif section == "miioo-worker":
        line = f"stdout_logfile={worker_log}"
    elif line.startswith("environment="):
      env_value = line[len("environment="):]
      if re.search(r'(^|,)PROD_VENV_DIR="[^"]*"', env_value):
        env_value = re.sub(
            r'(^|,)PROD_VENV_DIR="[^"]*"',
            lambda m: f'{m.group(1)}PROD_VENV_DIR="{release_venv_dir}"',
            env_value,
            count=1,
        )
      else:
        env_value = f'PROD_VENV_DIR="{release_venv_dir}",{env_value}'
      line = f"environment={env_value}"
    lines.append(line)

target_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
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

rollback_on_error() {
  local exit_code=$?

  if [ "${SWITCH_APPLIED:-0}" != "1" ]; then
    exit "${exit_code}"
  fi

  echo "检测到新目录切换失败，开始回滚到旧后端..."
  if [ -n "${SUPERVISOR_BACKUP_PATH:-}" ] && [ -f "${SUPERVISOR_BACKUP_PATH}" ]; then
    cp -f "${SUPERVISOR_BACKUP_PATH}" "${SUPERVISOR_PATH}" || true
  fi

  supervisorctl reread || true
  supervisorctl update || true

  local names
  names="$(current_service_names || true)"
  if [ -n "${names}" ]; then
    supervisorctl restart ${names} || true
  fi

  echo "=== ROLLBACK STATUS ==="
  supervisorctl status || true
  exit "${exit_code}"
}

trap rollback_on_error ERR

require_cmd tar
require_cmd supervisorctl
require_cmd curl
require_cmd python3

ts="$(date +%Y%m%d_%H%M%S)"
RELEASE_ROOT="${RELEASES_DIR}/${ts}"
RELEASE_BACKEND_DIR="${RELEASE_ROOT}/backend"
RELEASE_VENV_DIR="${RELEASE_BACKEND_DIR}/.venv"
PYTHON_BIN="$(pick_python_bin)"
SWITCH_APPLIED="0"
CURRENT_NGINX_PATH=""
SOURCE_LABEL="${SOURCE_LABEL:-}"

mkdir -p "${BACKUP_DIR}" "${RELEASES_DIR}" "${RELEASE_BACKEND_DIR}"

FULL_BACKEND_BACKUP="${BACKUP_DIR}/backend_full_before_${ts}.tgz"
SUPERVISOR_BACKUP_PATH="${BACKUP_DIR}/miioo-backend.ini.before_${ts}"
CURRENT_NGINX_PATH="$(grep -R -l '/www/wwwroot/miiooaib.com/backend/uploads' /etc/nginx /www/server/panel/vhost 2>/dev/null | head -n 1 || true)"

echo "备份当前线上后端到 ${FULL_BACKEND_BACKUP}"
tar -czf "${FULL_BACKEND_BACKUP}" -C "${REMOTE_ROOT}" backend

echo "备份当前 Supervisor 配置到 ${SUPERVISOR_BACKUP_PATH}"
cp -f "${SUPERVISOR_PATH}" "${SUPERVISOR_BACKUP_PATH}"

if [ -n "${CURRENT_NGINX_PATH}" ] && [ -f "${CURRENT_NGINX_PATH}" ]; then
  NGINX_BACKUP_PATH="${BACKUP_DIR}/$(basename "${CURRENT_NGINX_PATH}").before_${ts}"
  echo "记录当前 Nginx 站点配置到 ${NGINX_BACKUP_PATH}"
  cp -f "${CURRENT_NGINX_PATH}" "${NGINX_BACKUP_PATH}"
fi

if [ -n "${SOURCE_LABEL}" ]; then
  echo "本次发布代码源: ${SOURCE_LABEL}"
fi

echo "解压新代码到 ${RELEASE_BACKEND_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_ROOT}"

if [ ! -d "${RELEASE_BACKEND_DIR}/app" ] && [ -d "${RELEASE_ROOT}/app" ]; then
  echo "检测到归档为扁平 backend 内容，移动到 ${RELEASE_BACKEND_DIR}"
  shopt -s dotglob nullglob
  for item in "${RELEASE_ROOT}"/*; do
    if [ "${item}" = "${RELEASE_BACKEND_DIR}" ]; then
      continue
    fi
    mv "${item}" "${RELEASE_BACKEND_DIR}/"
  done
  shopt -u dotglob nullglob
fi

if [ ! -d "${RELEASE_BACKEND_DIR}/app" ]; then
  echo "新发布目录缺少 app/，解压结果异常: ${RELEASE_BACKEND_DIR}" >&2
  exit 1
fi

echo "复制线上 .env 到新目录"
cp -f "${LIVE_BACKEND_DIR}/.env" "${RELEASE_BACKEND_DIR}/.env"

mkdir -p "${RELEASE_BACKEND_DIR}/logs/supervisor"

echo "使用 ${PYTHON_BIN} 创建新虚拟环境"
"${PYTHON_BIN}" -m venv "${RELEASE_VENV_DIR}"
"${RELEASE_VENV_DIR}/bin/python" -m pip install --upgrade pip
"${RELEASE_VENV_DIR}/bin/pip" install -r "${RELEASE_BACKEND_DIR}/requirements.txt"

echo "在新目录执行 Alembic 迁移"
(
  cd "${RELEASE_BACKEND_DIR}"
  source "${RELEASE_VENV_DIR}/bin/activate"
  alembic upgrade head
)

echo "修正新目录权限，确保 www 进程可读取代码与 .env"
chown -R www:www "${RELEASE_BACKEND_DIR}"
chmod 640 "${RELEASE_BACKEND_DIR}/.env"

echo "切换 Supervisor 到新目录 ${RELEASE_BACKEND_DIR}"
update_supervisor_config "${SUPERVISOR_BACKUP_PATH}" "${SUPERVISOR_PATH}" "${RELEASE_BACKEND_DIR}"

SWITCH_APPLIED="1"
supervisorctl reread
supervisorctl update

NAMES="$(current_service_names)"
if [ -n "${NAMES}" ]; then
  supervisorctl restart ${NAMES}
fi

echo "等待 Web 健康检查"
if ! wait_for_docs_ready; then
  echo "新目录启动后 /docs 未在预期时间内返回 200" >&2
  exit 1
fi

echo "=== RELEASE ROOT ==="
echo "${RELEASE_ROOT}"
echo "=== STATUS ==="
supervisorctl status
echo "=== DOCS ==="
curl -I -s http://127.0.0.1:8000/docs | head -n 5
echo "=== PUBLIC DOCS ==="
curl -I -s https://www.miiooai.com/docs | head -n 5
echo "=== CURRENT NGINX CONFIG ==="
if [ -n "${CURRENT_NGINX_PATH}" ]; then
  echo "${CURRENT_NGINX_PATH}"
else
  echo "未定位到显式包含 backend/uploads 的 Nginx 配置文件"
fi
echo "=== BACKUPS ==="
echo "${FULL_BACKEND_BACKUP}"
echo "${SUPERVISOR_BACKUP_PATH}"
