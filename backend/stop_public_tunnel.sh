#!/bin/bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${BACKEND_DIR}/.runtime"
QUIET_IF_NONE=0

if [ "${1:-}" = "--quiet-if-none" ]; then
  QUIET_IF_NONE=1
fi

stop_pid_file() {
  local pid_file="$1"
  local label="$2"

  if [ ! -f "${pid_file}" ]; then
    return 1
  fi

  local pid=""
  pid="$(tr -d '[:space:]' < "${pid_file}" 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
    echo "🛑 正在停止 ${label}（PID=${pid}）..."
    kill "${pid}" 2>/dev/null || true
    for _ in $(seq 1 5); do
      if ! kill -0 "${pid}" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "${pid}" 2>/dev/null; then
      echo "⚠️ ${label} 未在 5 秒内退出，追加强制结束（PID=${pid}）..."
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi

  rm -f "${pid_file}"
  return 0
}

cleanup_runtime_files() {
  rm -f \
    "${RUNTIME_DIR}/cloudflared_public_url" \
    "${RUNTIME_DIR}/localtunnel_public_url" \
    "${RUNTIME_DIR}/public_base_url"
}

main() {
  local stopped_any=0

  mkdir -p "${RUNTIME_DIR}"

  if stop_pid_file "${RUNTIME_DIR}/cloudflared.pid" "Cloudflare Tunnel"; then
    stopped_any=1
  fi
  if stop_pid_file "${RUNTIME_DIR}/localtunnel.pid" "LocalTunnel"; then
    stopped_any=1
  fi

  cleanup_runtime_files

  if [ "${stopped_any}" = "1" ]; then
    echo "✅ 本地公网隧道已关闭，并已清理运行时公网地址文件。"
    return
  fi

  if [ "${QUIET_IF_NONE}" = "1" ]; then
    return
  fi

  echo "ℹ️ 当前未检测到正在运行的本地公网隧道，但运行时公网地址文件已清理。"
}

main "$@"
