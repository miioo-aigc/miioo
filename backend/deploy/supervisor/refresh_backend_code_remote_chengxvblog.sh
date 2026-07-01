#!/bin/bash
set -euo pipefail

REMOTE_ROOT="/www/wwwroot/chengxvblog.top"
BACKEND_DIR="${REMOTE_ROOT}/backend"
BACKUP_DIR="${REMOTE_ROOT}/deploy_backups"
ARCHIVE_NAME="${1:-}"
PYTHON_BIN="/usr/bin/python3"
SUPERVISOR_CONF="/etc/supervisor/conf.d/chengxvblog-backend.conf"
NGINX_EXT_APEX="/www/server/panel/vhost/nginx/extension/chengxvblog.top/backend_proxy.conf"
NGINX_EXT_WWW="/www/server/panel/vhost/nginx/extension/www.chengxvblog.top/backend_proxy.conf"

if [ -z "${ARCHIVE_NAME}" ]; then
  echo "用法: bash refresh_backend_code_remote_chengxvblog.sh <archive_name>" >&2
  exit 1
fi

ARCHIVE_PATH="/tmp/${ARCHIVE_NAME}"
if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "未找到代码包: ${ARCHIVE_PATH}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
ts="$(date +%Y%m%d_%H%M%S)"

if [ -f "/usr/bin/python3.10" ]; then
  chmod 755 /usr/bin/python3.10
fi

if ! "${PYTHON_BIN}" --version >/dev/null 2>&1; then
  echo "修复后仍无法执行 ${PYTHON_BIN}，请先检查服务器 Python 环境。" >&2
  exit 1
fi

backup_items=(
  "backend/app"
  "backend/alembic"
  "backend/deploy"
  "backend/nginx"
  "backend/scripts"
  "backend/脚本"
  "backend/tests"
  "backend/loadtest"
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
  "${BACKEND_DIR}/tests"
  "${BACKEND_DIR}/loadtest"
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

if [ ! -x "${BACKEND_DIR}/.venv/bin/python" ]; then
  rm -rf "${BACKEND_DIR}/.venv"
  "${PYTHON_BIN}" -m venv "${BACKEND_DIR}/.venv"
  chown -R www:www "${BACKEND_DIR}/.venv"
fi

cd "${BACKEND_DIR}"
"${BACKEND_DIR}/.venv/bin/python" -m pip install --upgrade pip
"${BACKEND_DIR}/.venv/bin/python" -m pip install -r requirements.txt
"${BACKEND_DIR}/.venv/bin/python" -m alembic upgrade head

mkdir -p "${BACKEND_DIR}/logs/supervisor"
mkdir -p "$(dirname "${NGINX_EXT_APEX}")" "$(dirname "${NGINX_EXT_WWW}")"

cat > "${NGINX_EXT_APEX}" <<'NGINX'
location ^~ /uploads/ {
    alias /www/wwwroot/chengxvblog.top/backend/uploads/;
    add_header Access-Control-Allow-Origin *;
    add_header Cache-Control "public, max-age=604800, immutable";
    add_header X-Static-Handled "nginx" always;
    expires 7d;
    access_log off;
    autoindex off;
}

# MEDIA main-domain routing start
resolver 1.1.1.1 8.8.8.8 ipv6=off valid=300s;
resolver_timeout 10s;
set $media_origin_upstream "https://miioob-1302811912.cos.ap-beijing.myqcloud.com";
set $media_origin_host "miioob-1302811912.cos.ap-beijing.myqcloud.com";
set $media_cdn_upstream "https://miioob-1302811912.cos.ap-beijing.myqcloud.com";
set $media_cdn_host "miioob-1302811912.cos.ap-beijing.myqcloud.com";

location ~ ^/media/origin/[^/]+/(?<media_origin_path>.*)$ {
    proxy_pass $media_origin_upstream/$media_origin_path$is_args$args;
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_ssl_name $media_origin_host;
    proxy_set_header Host $media_origin_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_buffering off;
    add_header X-Media-Proxy "origin" always;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}

location ~ ^/media/cdn/[^/]+/(?<media_cdn_path>.*)$ {
    proxy_pass $media_cdn_upstream/$media_cdn_path$is_args$args;
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_ssl_name $media_cdn_host;
    proxy_set_header Host $media_cdn_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    add_header X-Media-Proxy "cdn" always;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}
# MEDIA main-domain routing end

location = /docs {
    proxy_pass http://127.0.0.1:18000/docs;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /openapi.json {
    proxy_pass http://127.0.0.1:18000/openapi.json;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ~ ^/api/(llm/chat/stream|projects/[^/]+/episodes/[^/]+/generate/stream|projects/[^/]+/script-workspace/chat/stream)$ {
    proxy_pass http://127.0.0.1:18000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    add_header X-Accel-Buffering no;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:18000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}
NGINX

cp "${NGINX_EXT_APEX}" "${NGINX_EXT_WWW}"

if [ -f "${SUPERVISOR_CONF}" ]; then
  supervisorctl reread
  supervisorctl update
  supervisorctl restart chengxvblog-web chengxvblog-worker
else
  echo "未找到 Supervisor 配置: ${SUPERVISOR_CONF}" >&2
  exit 1
fi

nginx -t
nginx -s reload

echo "=== PYTHON ==="
"${PYTHON_BIN}" --version
echo "=== SUPERVISOR ==="
supervisorctl status chengxvblog-web chengxvblog-worker || true
echo "=== DOCS LOCAL ==="
curl -I -s http://127.0.0.1:18000/docs | head -n 5 || true
echo "=== API THROUGH NGINX ==="
curl -I -s -H "Host: chengxvblog.top" http://127.0.0.1/api/providers | head -n 5 || true
echo "=== OPENAPI THROUGH NGINX ==="
curl -I -s -H "Host: chengxvblog.top" http://127.0.0.1/openapi.json | head -n 5 || true
