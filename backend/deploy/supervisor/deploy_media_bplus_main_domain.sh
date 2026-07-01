#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_SCRIPT_PATH="/tmp/apply_media_bplus_main_domain_remote.py"
REMOTE_HOST="${REMOTE_HOST:-129.211.162.176}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "缺少环境变量: ${name}" >&2
    exit 1
  fi
}

run_with_expect() {
  local program=("$@")
  REMOTE_PASSWORD="${REMOTE_PASSWORD}" expect -f - -- "${program[@]}" <<'EOF'
set timeout -1
set password $env(REMOTE_PASSWORD)
set program [lrange $argv 0 end]
spawn {*}$program
expect {
  -re "(?i)yes/no" {
    send -- "yes\r"
    exp_continue
  }
  -re "(?i)password:" {
    send -- "$password\r"
    exp_continue
  }
  eof {
    catch wait result
    set exit_code [lindex $result 3]
    exit $exit_code
  }
}
EOF
}

print_help() {
  cat <<'EOF'
用途：
  把 MEDIA-BPLUS 首轮单域名主域复用配置安全下发到线上：
  - 备份远端 .env / Supervisor / Nginx
  - 补齐 MEDIA_* 环境变量
  - 给现有 Nginx 增加 /media/origin 与 /media/cdn
  - 校验 nginx 并重载
  - reread/update/restart Supervisor

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  bash backend/deploy/supervisor/deploy_media_bplus_main_domain.sh

可选环境变量：
  REMOTE_HOST=129.211.162.176
  REMOTE_USER=root
  MEDIA_STORAGE_MODE=local
  MEDIA_PUBLIC_BASE_URL=https://www.miiooai.com/media/origin
  MEDIA_CDN_BASE_URL=https://www.miiooai.com/media/cdn
  MEDIA_OBJECT_STORAGE_PROVIDER=tencent_cos
  MEDIA_OBJECT_STORAGE_REGION=
  MEDIA_OBJECT_STORAGE_SECRET_ID=
  MEDIA_OBJECT_STORAGE_SECRET_KEY=
  MEDIA_OBJECT_STORAGE_BUCKET_RAW=
  MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW=
  MEDIA_OBJECT_STORAGE_BUCKET_DERIVED=
  MEDIA_OBJECT_STORAGE_BUCKET_HLS=
  MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD=
  MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW=raw
  MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW=preview
  MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED=derived
  MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS=hls
  MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD=private-download
  MEDIA_ORIGIN_UPSTREAM=https://<bucket>.cos.<region>.myqcloud.com
  MEDIA_ORIGIN_HOST=<bucket>.cos.<region>.myqcloud.com
  MEDIA_CDN_UPSTREAM=https://cdn.example.com
  MEDIA_CDN_HOST=cdn.example.com

说明：
  - 若暂时没有 COS/CDN 真值，可不传 MEDIA_ORIGIN_* / MEDIA_CDN_*；
    远端会保留占位值，并在命中 /media/origin|cdn 时返回 503。
  - 首次建议保持 MEDIA_STORAGE_MODE=local；待回源、bucket、secret 都补齐后再切 hybrid。
EOF
}

main() {
  if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    print_help
    exit 0
  fi

  require_cmd expect
  require_cmd scp
  require_cmd ssh
  require_env REMOTE_PASSWORD

  echo "上传远端补丁脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/apply_media_bplus_main_domain_remote.py" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端执行 MEDIA-BPLUS 单域名主域复用收口"
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "MEDIA_STORAGE_MODE='${MEDIA_STORAGE_MODE:-local}' \
MEDIA_PUBLIC_BASE_URL='${MEDIA_PUBLIC_BASE_URL:-https://www.miiooai.com/media/origin}' \
MEDIA_CDN_BASE_URL='${MEDIA_CDN_BASE_URL:-https://www.miiooai.com/media/cdn}' \
MEDIA_OBJECT_STORAGE_PROVIDER='${MEDIA_OBJECT_STORAGE_PROVIDER:-tencent_cos}' \
MEDIA_OBJECT_STORAGE_REGION='${MEDIA_OBJECT_STORAGE_REGION:-}' \
MEDIA_OBJECT_STORAGE_SECRET_ID='${MEDIA_OBJECT_STORAGE_SECRET_ID:-}' \
MEDIA_OBJECT_STORAGE_SECRET_KEY='${MEDIA_OBJECT_STORAGE_SECRET_KEY:-}' \
MEDIA_OBJECT_STORAGE_BUCKET_RAW='${MEDIA_OBJECT_STORAGE_BUCKET_RAW:-}' \
MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW='${MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW:-}' \
MEDIA_OBJECT_STORAGE_BUCKET_DERIVED='${MEDIA_OBJECT_STORAGE_BUCKET_DERIVED:-}' \
MEDIA_OBJECT_STORAGE_BUCKET_HLS='${MEDIA_OBJECT_STORAGE_BUCKET_HLS:-}' \
MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD='${MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD:-}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW:-raw}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW:-preview}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED:-derived}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS:-hls}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD:-private-download}' \
MEDIA_ORIGIN_UPSTREAM='${MEDIA_ORIGIN_UPSTREAM:-}' \
MEDIA_ORIGIN_HOST='${MEDIA_ORIGIN_HOST:-}' \
MEDIA_CDN_UPSTREAM='${MEDIA_CDN_UPSTREAM:-}' \
MEDIA_CDN_HOST='${MEDIA_CDN_HOST:-}' \
python3 '${REMOTE_SCRIPT_PATH}'"

  echo "远端 MEDIA-BPLUS 单域名部署骨架已执行完成"
}

main "$@"
