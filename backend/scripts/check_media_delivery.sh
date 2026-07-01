#!/bin/bash
set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
info() { echo "       $*"; }

BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
UPLOAD_DIR="${UPLOAD_DIR:-${BACKEND_DIR}/uploads}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://www.miiooai.com}"
LOCAL_BASE_URL="${LOCAL_BASE_URL:-http://127.0.0.1:8000}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-15}"
FOLLOW_REDIRECTS="${FOLLOW_REDIRECTS:-false}"
AUTH_HEADER="${AUTH_HEADER:-}"
COOKIE_HEADER="${COOKIE_HEADER:-}"

if [ ! -d "${UPLOAD_DIR}" ] && [ -d "${BACKEND_DIR}/backend/uploads" ]; then
  UPLOAD_DIR="${BACKEND_DIR}/backend/uploads"
fi

print_help() {
  cat <<'EOF'
用法：
  bash backend/scripts/check_media_delivery.sh <url1> [url2 ...]

说明：
  - 支持相对路径和绝对 URL
  - 重点诊断 controlled download、/uploads/、HLS playlist 三类链路
  - 默认同时给出 local/public 两个探测结果

可覆盖环境变量：
  BACKEND_DIR
  UPLOAD_DIR
  PUBLIC_BASE_URL
  LOCAL_BASE_URL
  REQUEST_TIMEOUT
  FOLLOW_REDIRECTS=true|false
  AUTH_HEADER="Authorization: Bearer <token>"
  COOKIE_HEADER="Cookie: <cookie>"

示例：
  bash backend/scripts/check_media_delivery.sh /uploads/assets/demo.png
  bash backend/scripts/check_media_delivery.sh /api/media/downloads/demo-token
  AUTH_HEADER="Authorization: Bearer xxx" \
    bash backend/scripts/check_media_delivery.sh /api/media/downloads/demo-token
  bash backend/scripts/check_media_delivery.sh https://cdn.example.com/demo.m3u8
EOF
}

if [ "$#" -eq 0 ]; then
  print_help
  exit 0
fi

contains() {
  case "$1" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

is_absolute_url() {
  case "$1" in
    http://*|https://*) return 0 ;;
    *) return 1 ;;
  esac
}

strip_query_fragment() {
  local value="$1"
  value="${value%%\#*}"
  value="${value%%\?*}"
  printf '%s' "${value}"
}

normalize_base_url() {
  printf '%s' "${1%/}"
}

join_url() {
  local base="${1%/}"
  local path="$2"
  if is_absolute_url "${path}"; then
    printf '%s' "${path}"
    return 0
  fi
  if contains "${path}" "/"; then
    if [ "${path#\/}" != "${path}" ]; then
      printf '%s%s' "${base}" "${path}"
      return 0
    fi
  fi
  printf '%s/%s' "${base}" "${path}"
}

resolve_playlist_segment_url() {
  local playlist_url="$1"
  local segment_path="$2"
  if is_absolute_url "${segment_path}"; then
    printf '%s' "${segment_path}"
    return 0
  fi
  local playlist_without_query
  playlist_without_query="$(strip_query_fragment "${playlist_url}")"
  local playlist_dir="${playlist_without_query%/*}"
  if [ "${segment_path#\/}" != "${segment_path}" ]; then
    local scheme_host
    scheme_host="$(printf '%s' "${playlist_without_query}" | sed -E 's#^(https?://[^/]+).*$#\1#')"
    printf '%s%s' "${scheme_host}" "${segment_path}"
    return 0
  fi
  printf '%s/%s' "${playlist_dir}" "${segment_path}"
}

classify_url() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if contains "${value}" "/api/media/downloads/" || contains "${value}" "/media/downloads/"; then
    printf '%s' "controlled_download"
  elif contains "${value}" ".m3u8"; then
    printf '%s' "hls_playlist"
  elif contains "${value}" "/uploads/"; then
    printf '%s' "managed_upload"
  elif contains "${value}" ".ts" || contains "${value}" ".m4s"; then
    printf '%s' "hls_segment"
  elif contains "${value}" ".jpg" || contains "${value}" ".jpeg" || contains "${value}" ".png" || contains "${value}" ".webp" || contains "${value}" ".avif" || contains "${value}" ".gif" || contains "${value}" ".svg"; then
    printf '%s' "image"
  elif contains "${value}" ".mp4" || contains "${value}" ".webm" || contains "${value}" ".mov" || contains "${value}" ".m4v"; then
    printf '%s' "video"
  elif contains "${value}" ".mp3" || contains "${value}" ".wav" || contains "${value}" ".m4a" || contains "${value}" ".aac" || contains "${value}" ".ogg"; then
    printf '%s' "audio"
  else
    printf '%s' "generic"
  fi
}

extract_upload_path() {
  local value="$1"
  local stripped
  stripped="$(strip_query_fragment "${value}")"
  if ! contains "${stripped}" "/uploads/"; then
    return 1
  fi
  printf '%s' "/uploads/${stripped#*\/uploads/}"
}

probe_http() {
  local url="$1"
  local mode="$2"
  local label="$3"
  local tmp_headers tmp_body status curl_exit curl_cmd

  tmp_headers="$(mktemp)"
  tmp_body="$(mktemp)"

  curl_cmd=(curl -sS --max-time "${REQUEST_TIMEOUT}" -D "${tmp_headers}" -o "${tmp_body}" -w "%{http_code}")
  if [ "${FOLLOW_REDIRECTS}" = "true" ] && [ "${mode}" != "controlled_download" ]; then
    curl_cmd+=(-L)
  fi
  if [ -n "${AUTH_HEADER}" ]; then
    curl_cmd+=(-H "${AUTH_HEADER}")
  fi
  if [ -n "${COOKIE_HEADER}" ]; then
    curl_cmd+=(-H "${COOKIE_HEADER}")
  fi

  case "${mode}" in
    hls_playlist)
      ;;
    controlled_download)
      ;;
    *)
      curl_cmd+=(-H "Range: bytes=0-0")
      ;;
  esac

  status="$("${curl_cmd[@]}" "${url}" 2>/dev/null)"
  curl_exit=$?

  if [ "${curl_exit}" -ne 0 ]; then
    fail "${label} 请求失败：${url}"
    info "curl exit code: ${curl_exit}"
    rm -f "${tmp_headers}" "${tmp_body}"
    return 1
  fi

  local content_type location content_length effective_status
  content_type="$(grep -i '^content-type:' "${tmp_headers}" | tail -n 1 | cut -d':' -f2- | tr -d '\r' | xargs)"
  location="$(grep -i '^location:' "${tmp_headers}" | tail -n 1 | cut -d':' -f2- | tr -d '\r' | xargs)"
  content_length="$(grep -i '^content-length:' "${tmp_headers}" | tail -n 1 | cut -d':' -f2- | tr -d '\r' | xargs)"
  effective_status="${status}"

  if [ "${status}" = "200" ] || [ "${status}" = "206" ] || [ "${status}" = "302" ] || [ "${status}" = "301" ]; then
    ok "${label} 返回 ${status} (${url})"
  elif [ "${status}" = "401" ] || [ "${status}" = "403" ] || [ "${status}" = "404" ]; then
    warn "${label} 返回 ${status} (${url})"
  else
    fail "${label} 返回 ${status} (${url})"
  fi

  [ -n "${content_type}" ] && info "content-type: ${content_type}"
  [ -n "${content_length}" ] && info "content-length: ${content_length}"
  [ -n "${location}" ] && info "location: ${location}"

  if [ "${mode}" = "hls_playlist" ] && [ "${effective_status}" = "200" -o "${effective_status}" = "206" ]; then
    local first_segment segment_url segment_status segment_headers segment_body
    first_segment="$(grep -v '^#' "${tmp_body}" | sed '/^[[:space:]]*$/d' | head -n 1)"
    if [ -n "${first_segment}" ]; then
      segment_url="$(resolve_playlist_segment_url "${url}" "${first_segment}")"
      info "first-segment: ${segment_url}"
      segment_headers="$(mktemp)"
      segment_body="$(mktemp)"
      segment_status="$(curl -sS --max-time "${REQUEST_TIMEOUT}" -D "${segment_headers}" -o "${segment_body}" -w "%{http_code}" -H "Range: bytes=0-0" "${segment_url}" 2>/dev/null)"
      if [ "$?" -eq 0 ]; then
        if [ "${segment_status}" = "200" ] || [ "${segment_status}" = "206" ]; then
          ok "HLS 分片可读：${segment_status}"
        else
          warn "HLS 分片返回 ${segment_status}"
        fi
      else
        fail "HLS 分片请求失败"
      fi
      rm -f "${segment_headers}" "${segment_body}"
    else
      warn "playlist 中未解析到有效分片"
    fi
  fi

  rm -f "${tmp_headers}" "${tmp_body}"
  return 0
}

check_upload_local_file() {
  local input_url="$1"
  local upload_path rel_path file_path
  upload_path="$(extract_upload_path "${input_url}")" || return 0
  rel_path="${upload_path#/uploads/}"
  file_path="${UPLOAD_DIR}/${rel_path}"
  if [ -f "${file_path}" ]; then
    ok "本地文件存在：${file_path}"
  else
    warn "本地文件不存在：${file_path}"
    info "若公网 404 且本地也不存在，优先排查 UPLOAD_DIR 持久化和 metadata 路径"
  fi
}

check_target() {
  local raw_input="$1"
  local mode local_url public_url

  mode="$(classify_url "${raw_input}")"

  echo ""
  echo "========================================================"
  echo "  检查目标：${raw_input}"
  echo "  类型：${mode}"
  echo "========================================================"

  if is_absolute_url "${raw_input}"; then
    probe_http "${raw_input}" "${mode}" "absolute"
    check_upload_local_file "${raw_input}"
    return 0
  fi

  local_url="$(join_url "$(normalize_base_url "${LOCAL_BASE_URL}")" "${raw_input}")"
  public_url="$(join_url "$(normalize_base_url "${PUBLIC_BASE_URL}")" "${raw_input}")"

  probe_http "${local_url}" "${mode}" "local"
  probe_http "${public_url}" "${mode}" "public"
  check_upload_local_file "${raw_input}"
}

echo ""
echo "========================================================"
echo "  媒体交付链路诊断"
echo "  local  : ${LOCAL_BASE_URL}"
echo "  public : ${PUBLIC_BASE_URL}"
echo "  timeout: ${REQUEST_TIMEOUT}s"
echo "========================================================"

for target in "$@"; do
  check_target "${target}"
done

echo ""
echo "========================================================"
echo "  诊断完成"
echo "========================================================"
echo ""
