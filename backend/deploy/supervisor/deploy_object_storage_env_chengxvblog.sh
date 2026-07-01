#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_SCRIPT_PATH="/tmp/apply_object_storage_env_chengxvblog_remote.py"
REMOTE_HOST="${REMOTE_HOST:-152.136.237.31}"
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
  把 chengxvblog 后端的对象存储环境变量安全写入线上 .env，
  并重启 Web / Worker，使新生成图片可同步上传到腾讯 COS。

用法：
  REMOTE_PASSWORD='你的服务器密码' \
  MEDIA_OBJECT_STORAGE_REGION='ap-beijing' \
  MEDIA_OBJECT_STORAGE_SECRET_ID='xxxx' \
  MEDIA_OBJECT_STORAGE_SECRET_KEY='xxxx' \
  MEDIA_OBJECT_STORAGE_BUCKET_RAW='bucket-name' \
  MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW='bucket-name' \
  MEDIA_OBJECT_STORAGE_BUCKET_DERIVED='bucket-name' \
  MEDIA_OBJECT_STORAGE_BUCKET_HLS='bucket-name' \
  MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD='bucket-name' \
  bash backend/deploy/supervisor/deploy_object_storage_env_chengxvblog.sh
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
  require_env MEDIA_OBJECT_STORAGE_REGION
  require_env MEDIA_OBJECT_STORAGE_SECRET_ID
  require_env MEDIA_OBJECT_STORAGE_SECRET_KEY
  require_env MEDIA_OBJECT_STORAGE_BUCKET_RAW

  echo "上传远端对象存储环境脚本到 ${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"
  run_with_expect scp \
    -o StrictHostKeyChecking=accept-new \
    "${SCRIPT_DIR}/apply_object_storage_env_chengxvblog_remote.py" \
    "${REMOTE_TARGET}:${REMOTE_SCRIPT_PATH}"

  echo "在远端写入对象存储环境变量并重启服务"
  run_with_expect ssh \
    -o StrictHostKeyChecking=accept-new \
    "${REMOTE_TARGET}" \
    "MEDIA_STORAGE_MODE='${MEDIA_STORAGE_MODE:-hybrid}' \
MEDIA_OBJECT_STORAGE_PROVIDER='${MEDIA_OBJECT_STORAGE_PROVIDER:-tencent_cos}' \
MEDIA_OBJECT_STORAGE_REGION='${MEDIA_OBJECT_STORAGE_REGION}' \
MEDIA_OBJECT_STORAGE_SECRET_ID='${MEDIA_OBJECT_STORAGE_SECRET_ID}' \
MEDIA_OBJECT_STORAGE_SECRET_KEY='${MEDIA_OBJECT_STORAGE_SECRET_KEY}' \
MEDIA_OBJECT_STORAGE_BUCKET_RAW='${MEDIA_OBJECT_STORAGE_BUCKET_RAW}' \
MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW='${MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW:-${MEDIA_OBJECT_STORAGE_BUCKET_RAW}}' \
MEDIA_OBJECT_STORAGE_BUCKET_DERIVED='${MEDIA_OBJECT_STORAGE_BUCKET_DERIVED:-${MEDIA_OBJECT_STORAGE_BUCKET_RAW}}' \
MEDIA_OBJECT_STORAGE_BUCKET_HLS='${MEDIA_OBJECT_STORAGE_BUCKET_HLS:-${MEDIA_OBJECT_STORAGE_BUCKET_RAW}}' \
MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD='${MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD:-${MEDIA_OBJECT_STORAGE_BUCKET_RAW}}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW:-raw}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW:-preview}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED:-derived}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS:-hls}' \
MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD='${MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD:-private-download}' \
python3 '${REMOTE_SCRIPT_PATH}'"
}

main "$@"
