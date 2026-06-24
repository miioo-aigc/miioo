#!/bin/bash
# Cloudflare Tunnel 快速启动脚本
# 用途：将本地 8000 端口暴露为公网 HTTPS 地址，并把 PUBLIC_BASE_URL 回写到 backend/.env

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"
RUNTIME_DIR="${BACKEND_DIR}/.runtime"
LOG_FILE="${RUNTIME_DIR}/cloudflared.log"
PID_FILE="${RUNTIME_DIR}/cloudflared.pid"
PUBLIC_URL_FILE="${RUNTIME_DIR}/cloudflared_public_url"
TUNNEL_PORT="${TUNNEL_PORT:-8000}"
TUNNEL_HOST="${TUNNEL_HOST:-127.0.0.1}"
TARGET_URL="${TUNNEL_TARGET_URL:-http://${TUNNEL_HOST}:${TUNNEL_PORT}}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file

  tmp_file="$(mktemp)"
  if [[ -f "${ENV_FILE}" ]] && grep -q "^${key}=" "${ENV_FILE}"; then
    awk -v key="${key}" -v value="${value}" '
      index($0, key "=") == 1 {
        print key "=" value
        updated = 1
        next
      }
      { print }
      END {
        if (!updated) {
          print key "=" value
        }
      }
    ' "${ENV_FILE}" > "${tmp_file}"
  else
    if [[ -f "${ENV_FILE}" ]]; then
      cat "${ENV_FILE}" > "${tmp_file}"
    fi
    printf "%s=%s\n" "${key}" "${value}" >> "${tmp_file}"
  fi

  mv "${tmp_file}" "${ENV_FILE}"
}

stop_existing_tunnel() {
  if [[ -f "${PID_FILE}" ]]; then
    local old_pid
    old_pid="$(cat "${PID_FILE}")"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
      echo "♻️ 检测到旧的 Cloudflare Tunnel 仍在运行，先停止旧进程: ${old_pid}"
      kill "${old_pid}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "${PID_FILE}"
  fi
}

cleanup() {
  local exit_code=$?
  if [[ -n "${TAIL_PID:-}" ]] && kill -0 "${TAIL_PID}" 2>/dev/null; then
    kill "${TAIL_PID}" 2>/dev/null || true
  fi
  if [[ -f "${PID_FILE}" ]]; then
    local tunnel_pid
    tunnel_pid="$(cat "${PID_FILE}")"
    if [[ -n "${tunnel_pid}" ]] && kill -0 "${tunnel_pid}" 2>/dev/null; then
      kill "${tunnel_pid}" 2>/dev/null || true
    fi
    rm -f "${PID_FILE}"
  fi
  exit "${exit_code}"
}

trap cleanup INT TERM EXIT

if ! command -v "${CLOUDFLARED_BIN}" >/dev/null 2>&1; then
  echo "❌ 未检测到 cloudflared，请先安装后再重试。"
  echo "   macOS 可执行：brew install cloudflared"
  exit 1
fi

mkdir -p "${RUNTIME_DIR}"
stop_existing_tunnel
: > "${LOG_FILE}"

echo "🚀 正在启动 Cloudflare Tunnel..."
echo "📌 本地服务：${TARGET_URL}"
echo "📝 日志文件：${LOG_FILE}"
echo ""

if ! curl --silent --show-error --max-time 2 "${TARGET_URL}" >/dev/null 2>&1; then
  echo "⚠️ 当前未探测到本地服务响应。"
  echo "   隧道仍会继续启动，但你需要先确认后端已运行在 ${TARGET_URL}（可先执行 ./start.sh）。"
  echo ""
fi

"${CLOUDFLARED_BIN}" tunnel --url "${TARGET_URL}" --no-autoupdate > "${LOG_FILE}" 2>&1 &
TUNNEL_PID=$!
echo "${TUNNEL_PID}" > "${PID_FILE}"

PUBLIC_URL=""
for _ in $(seq 1 30); do
  if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    echo "❌ Cloudflare Tunnel 启动失败，日志如下："
    cat "${LOG_FILE}"
    exit 1
  fi

  PUBLIC_URL="$(grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' "${LOG_FILE}" | head -n 1 || true)"
  if [[ -n "${PUBLIC_URL}" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "${PUBLIC_URL}" ]]; then
  echo "❌ 30 秒内未获取到临时公网域名，请检查日志：${LOG_FILE}"
  exit 1
fi

set_env_value "PUBLIC_BASE_URL" "${PUBLIC_URL}"
set_env_value "SERVE_UPLOADS_VIA_APP" "true"
printf "%s\n" "${PUBLIC_URL}" > "${PUBLIC_URL_FILE}"

echo "✅ 隧道已启动：${PUBLIC_URL}"
echo "✅ 已回写 ${ENV_FILE}"
echo "   - PUBLIC_BASE_URL=${PUBLIC_URL}"
echo "   - SERVE_UPLOADS_VIA_APP=true"
echo "📄 当前公网地址已保存到：${PUBLIC_URL_FILE}"
echo ""
echo "下一步："
echo "1. 用 ${PUBLIC_URL}/uploads/... 验证素材可匿名访问"
echo "2. 直接重试依赖公网地址的任务；当前视频生成链路会优先读取 .runtime 中的活跃隧道地址"
echo "3. 若你还有其他仅在进程启动时读取 PUBLIC_BASE_URL 的旧逻辑，再手工重启后端"
echo "4. 保持本窗口运行；按 Ctrl+C 可关闭隧道"
echo ""

tail -n 20 -f "${LOG_FILE}" &
TAIL_PID=$!
wait "${TUNNEL_PID}"
