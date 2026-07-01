#!/bin/bash
set -euo pipefail

REMOTE_ROOT="/www/wwwroot/chengxvblog.top"
LIVE_FRONTEND_DIR="${REMOTE_ROOT}/frontend_new"
RELEASES_DIR="${REMOTE_ROOT}/frontend_new_releases"
BACKUP_DIR="${REMOTE_ROOT}/deploy_backups"
ARCHIVE_NAME="${1:-}"
ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
NODE_BIN="/www/server/nodejs/v22.15.0/bin/node"
NPM_BIN="/www/server/nodejs/v22.15.0/bin/npm"
SUPERVISOR_CONF="/etc/supervisor/conf.d/chengxvblog-frontend-new.conf"
NGINX_EXT_APEX="/www/server/panel/vhost/nginx/extension/chengxvblog.top/frontend_new_dev_proxy.conf"
NGINX_EXT_WWW="/www/server/panel/vhost/nginx/extension/www.chengxvblog.top/frontend_new_dev_proxy.conf"
LEGACY_NGINX_EXT_APEX="/www/server/panel/vhost/nginx/extension/chengxvblog.top/frontend_dev_proxy.conf"
LEGACY_NGINX_EXT_WWW="/www/server/panel/vhost/nginx/extension/www.chengxvblog.top/frontend_dev_proxy.conf"
FRONTEND_LOG_DIR="${REMOTE_ROOT}/frontend_new_logs"

if [ -z "${ARCHIVE_NAME}" ]; then
  echo "用法: bash refresh_frontend_new_dev_chengxvblog.sh <archive_name>" >&2
  exit 1
fi

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "未找到前端代码包: ${ARCHIVE_PATH}" >&2
  exit 1
fi

if [ ! -x "${NODE_BIN}" ] || [ ! -f "${NPM_BIN}" ]; then
  echo "未找到可用的 Node.js 22 运行时: ${NODE_BIN} / ${NPM_BIN}" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

current_frontend_dir() {
  if [ -f "${SUPERVISOR_CONF}" ]; then
    awk -F= '/^directory=/{print $2; exit}' "${SUPERVISOR_CONF}"
    return
  fi
  printf '%s\n' "${LIVE_FRONTEND_DIR}"
}

update_supervisor_config() {
  local source_path="$1"
  local target_path="$2"
  local release_dir="$3"

  RELEASE_DIR="${release_dir}" \
  NPM_BIN_PATH="${NPM_BIN}" \
  FRONTEND_LOG_DIR_PATH="${FRONTEND_LOG_DIR}" \
  python3 - "${source_path}" "${target_path}" <<'PY'
from pathlib import Path
import os
import re
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
release_dir = os.environ["RELEASE_DIR"]
npm_bin = os.environ["NPM_BIN_PATH"]
log_dir = os.environ["FRONTEND_LOG_DIR_PATH"]

if source.exists():
    lines = source.read_text(encoding="utf-8").splitlines()
else:
    lines = [
        "[program:chengxvblog-frontend-new]",
        f"directory={release_dir}",
        f"command={npm_bin} run dev -- --host 0.0.0.0 --port 3000",
        "user=www",
        "autostart=true",
        "autorestart=true",
        "startsecs=5",
        "startretries=3",
        "stopsignal=TERM",
        "stopasgroup=true",
        "killasgroup=true",
        f"stdout_logfile={log_dir}/frontend_new.log",
        "stdout_logfile_maxbytes=20MB",
        "stdout_logfile_backups=10",
        "redirect_stderr=true",
        f'environment=PATH="/www/server/nodejs/v22.15.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",HOME="{release_dir}",NODE_ENV="development"',
    ]

updated = []
env_done = False
for raw in lines:
    line = raw
    if line.startswith("directory="):
      line = f"directory={release_dir}"
    elif line.startswith("command="):
      line = f"command={npm_bin} run dev -- --host 0.0.0.0 --port 3000"
    elif line.startswith("stdout_logfile="):
      line = f"stdout_logfile={log_dir}/frontend_new.log"
    elif line.startswith("environment="):
      env_value = line[len("environment="):]
      if re.search(r'(^|,)HOME="[^"]*"', env_value):
        env_value = re.sub(
            r'(^|,)HOME="[^"]*"',
            lambda m: f'{m.group(1)}HOME="{release_dir}"',
            env_value,
            count=1,
        )
      else:
        env_value = f'HOME="{release_dir}",{env_value}'
      if re.search(r'(^|,)NODE_ENV="[^"]*"', env_value):
        env_value = re.sub(
            r'(^|,)NODE_ENV="[^"]*"',
            lambda m: f'{m.group(1)}NODE_ENV="development"',
            env_value,
            count=1,
        )
      else:
        env_value = f'NODE_ENV="development",{env_value}'
      line = f"environment={env_value}"
      env_done = True
    updated.append(line)

if not env_done:
    updated.append(
        f'environment=PATH="/www/server/nodejs/v22.15.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",HOME="{release_dir}",NODE_ENV="development"'
    )

target.write_text("\n".join(updated) + "\n", encoding="utf-8")
PY
}

wait_for_frontend_ready() {
  local attempts=30
  local index

  for ((index = 1; index <= attempts; index += 1)); do
    if curl -I -s http://127.0.0.1:3000/ | grep -q '200'; then
      return 0
    fi
    sleep 2
  done

  return 1
}

restore_file_or_remove() {
  local backup_path="$1"
  local target_path="$2"
  if [ -n "${backup_path}" ] && [ -f "${backup_path}" ]; then
    cp -f "${backup_path}" "${target_path}"
  else
    rm -f "${target_path}"
  fi
}

rollback_on_error() {
  local exit_code=$?
  if [ "${SWITCH_APPLIED:-0}" != "1" ]; then
    exit "${exit_code}"
  fi

  echo "检测到 frontend_new 新目录切换失败，开始回滚..."
  if [ -n "${SUPERVISOR_BACKUP_PATH:-}" ] && [ -f "${SUPERVISOR_BACKUP_PATH}" ]; then
    cp -f "${SUPERVISOR_BACKUP_PATH}" "${SUPERVISOR_CONF}" || true
  fi
  restore_file_or_remove "${NGINX_APEX_BACKUP_PATH:-}" "${NGINX_EXT_APEX}"
  restore_file_or_remove "${NGINX_WWW_BACKUP_PATH:-}" "${NGINX_EXT_WWW}"

  supervisorctl reread || true
  supervisorctl update || true
  supervisorctl restart chengxvblog-frontend-new || true
  nginx -t || true
  nginx -s reload || true
  echo "=== ROLLBACK STATUS ==="
  supervisorctl status chengxvblog-frontend-new || true
  exit "${exit_code}"
}

trap rollback_on_error ERR

require_cmd tar
require_cmd supervisorctl
require_cmd curl
require_cmd python3

mkdir -p "${BACKUP_DIR}" "${FRONTEND_LOG_DIR}" "${RELEASES_DIR}"
ts="$(date +%Y%m%d_%H%M%S)"
CURRENT_FRONTEND_DIR="$(current_frontend_dir)"
RELEASE_ROOT="${RELEASES_DIR}/${ts}"
RELEASE_FRONTEND_DIR="${RELEASE_ROOT}/frontend_new"
SWITCH_APPLIED="0"
SUPERVISOR_BACKUP_PATH=""
NGINX_APEX_BACKUP_PATH=""
NGINX_WWW_BACKUP_PATH=""
CURRENT_FRONTEND_BACKUP="${BACKUP_DIR}/frontend_new_before_${ts}.tgz"

if [ -n "${CURRENT_FRONTEND_DIR}" ] && [ -d "${CURRENT_FRONTEND_DIR}" ]; then
  echo "备份当前运行目录到 ${CURRENT_FRONTEND_BACKUP}"
  tar -czf "${CURRENT_FRONTEND_BACKUP}" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='logs' \
    --exclude='.env' \
    -C "$(dirname "${CURRENT_FRONTEND_DIR}")" \
    "$(basename "${CURRENT_FRONTEND_DIR}")"
fi

if [ -f "${SUPERVISOR_CONF}" ]; then
  SUPERVISOR_BACKUP_PATH="${BACKUP_DIR}/chengxvblog-frontend-new.conf.before_${ts}"
  cp -f "${SUPERVISOR_CONF}" "${SUPERVISOR_BACKUP_PATH}"
fi

if [ -f "${NGINX_EXT_APEX}" ]; then
  NGINX_APEX_BACKUP_PATH="${BACKUP_DIR}/frontend_new_dev_proxy.apex.before_${ts}.conf"
  cp -f "${NGINX_EXT_APEX}" "${NGINX_APEX_BACKUP_PATH}"
fi

if [ -f "${NGINX_EXT_WWW}" ]; then
  NGINX_WWW_BACKUP_PATH="${BACKUP_DIR}/frontend_new_dev_proxy.www.before_${ts}.conf"
  cp -f "${NGINX_EXT_WWW}" "${NGINX_WWW_BACKUP_PATH}"
fi

mkdir -p "${RELEASE_ROOT}"
echo "解压新前端代码到 ${RELEASE_FRONTEND_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_ROOT}"

if [ ! -d "${RELEASE_FRONTEND_DIR}/src" ]; then
  echo "新发布目录缺少 src/，解压结果异常: ${RELEASE_FRONTEND_DIR}" >&2
  exit 1
fi

ENV_SOURCE_DIR="${CURRENT_FRONTEND_DIR}"
if [ ! -f "${ENV_SOURCE_DIR}/.env" ] && [ -f "${LIVE_FRONTEND_DIR}/.env" ]; then
  ENV_SOURCE_DIR="${LIVE_FRONTEND_DIR}"
fi

if [ ! -f "${ENV_SOURCE_DIR}/.env" ]; then
  echo "未找到可复用的线上 .env，请先在云端准备 ${LIVE_FRONTEND_DIR}/.env" >&2
  exit 1
fi

echo "复制线上 .env 到新目录"
cp -f "${ENV_SOURCE_DIR}/.env" "${RELEASE_FRONTEND_DIR}/.env"

if [ -f "${ENV_SOURCE_DIR}/.npmrc" ]; then
  cp -f "${ENV_SOURCE_DIR}/.npmrc" "${RELEASE_FRONTEND_DIR}/.npmrc"
else
  cat > "${RELEASE_FRONTEND_DIR}/.npmrc" <<'NPMEOF'
registry=https://registry.npmjs.org/
NPMEOF
fi

chown -R www:www "${RELEASE_FRONTEND_DIR}"
chmod 640 "${RELEASE_FRONTEND_DIR}/.env"
mkdir -p "${RELEASE_FRONTEND_DIR}/.npm-cache"
chown -R www:www "${RELEASE_FRONTEND_DIR}/.npm-cache"

echo "在新目录安装依赖"
su -s /bin/bash -c "cd '${RELEASE_FRONTEND_DIR}' && HOME='${RELEASE_FRONTEND_DIR}' npm_config_cache='${RELEASE_FRONTEND_DIR}/.npm-cache' '${NPM_BIN}' install" www
chown -R www:www "${RELEASE_FRONTEND_DIR}"

update_supervisor_config "${SUPERVISOR_CONF}" "${SUPERVISOR_CONF}" "${RELEASE_FRONTEND_DIR}"

mkdir -p "$(dirname "${NGINX_EXT_APEX}")" "$(dirname "${NGINX_EXT_WWW}")"

rm -f "${LEGACY_NGINX_EXT_APEX}" "${LEGACY_NGINX_EXT_WWW}"

cat > "${NGINX_EXT_APEX}" <<'NGINX'
location ^~ /node_modules/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /src/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}
NGINX

cp "${NGINX_EXT_APEX}" "${NGINX_EXT_WWW}"

SWITCH_APPLIED="1"
supervisorctl reread
supervisorctl update
supervisorctl restart chengxvblog-frontend-new
nginx -t
nginx -s reload

echo "等待 frontend_new 健康检查"
if ! wait_for_frontend_ready; then
  echo "新目录启动后 3000 端口未在预期时间内返回 200" >&2
  exit 1
fi

echo "=== FRONTEND SUPERVISOR ==="
supervisorctl status chengxvblog-frontend-new || true
echo "=== RELEASE ROOT ==="
echo "${RELEASE_ROOT}"
echo "=== FRONTEND LOCAL ==="
curl -I -s http://127.0.0.1:3000/ | head -n 5 || true
echo "=== FRONTEND DOMAIN ==="
curl -I -s -H "Host: chengxvblog.top" http://127.0.0.1/ | head -n 5 || true
echo "=== FRONTEND API VIA DOMAIN ==="
curl -I -s -H "Host: chengxvblog.top" http://127.0.0.1/api/providers | head -n 5 || true
echo "=== BACKUPS ==="
echo "${CURRENT_FRONTEND_BACKUP}"
if [ -n "${SUPERVISOR_BACKUP_PATH}" ]; then
  echo "${SUPERVISOR_BACKUP_PATH}"
fi
