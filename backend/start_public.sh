#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/_runtime_bootstrap.sh"

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="${BACKEND_DIR}/.runtime"
BACKEND_PID_FILE="${RUNTIME_DIR}/backend_public.pid"
BACKEND_LOG_FILE="${RUNTIME_DIR}/backend_public.log"
PUBLIC_BACKEND_MODE="${PUBLIC_BACKEND_MODE:-dev}"
PUBLIC_TUNNEL_SCRIPT="${PUBLIC_TUNNEL_SCRIPT:-${BACKEND_DIR}/tunnel.sh}"

resolve_backend_start_script() {
  case "${PUBLIC_BACKEND_MODE}" in
    dev)
      printf '%s' "${BACKEND_DIR}/start.sh"
      ;;
    db)
      printf '%s' "${BACKEND_DIR}/脚本/start_db_and_server.sh"
      ;;
    *)
      echo "不支持的 PUBLIC_BACKEND_MODE=${PUBLIC_BACKEND_MODE}，可选值: dev / db" >&2
      exit 1
      ;;
  esac
}

is_pid_alive() {
  local pid_file="${1:-}"
  [ -n "${pid_file}" ] || return 1
  [ -f "${pid_file}" ] || return 1

  local pid=""
  pid="$(tr -d '[:space:]' < "${pid_file}" 2>/dev/null || true)"
  [ -n "${pid}" ] || return 1

  kill -0 "${pid}" 2>/dev/null
}

start_backend_if_needed() {
  local backend_start_script="${1:-}"
  local existing_listeners=""

  mkdir -p "${RUNTIME_DIR}"
  existing_listeners="$(find_listening_processes_by_port "8000")"
  if [ -n "${existing_listeners}" ]; then
    echo "检测到 8000 端口已有后端服务在运行，跳过重复启动。"
    printf '%s\n' "${existing_listeners}"
    return
  fi

  if is_pid_alive "${BACKEND_PID_FILE}"; then
    echo "检测到公网启动入口上次拉起的后端进程仍存活，但端口暂未监听，继续等待服务就绪。"
    return
  fi

  : > "${BACKEND_LOG_FILE}"
  echo "🚀 正在后台启动后端（PUBLIC_BACKEND_MODE=${PUBLIC_BACKEND_MODE}）..."
  echo "📝 后端日志：${BACKEND_LOG_FILE}"

  (
    cd "${BACKEND_DIR}"
    BACKEND_DEV_RELOAD=off bash "${backend_start_script}"
  ) > "${BACKEND_LOG_FILE}" 2>&1 &
  echo "$!" > "${BACKEND_PID_FILE}"
}

wait_for_backend_ready() {
  local backend_start_script="${1:-}"

  for _ in $(seq 1 45); do
    if curl --silent --show-error --max-time 2 "http://127.0.0.1:8000" >/dev/null 2>&1; then
      echo "✅ 后端已就绪：http://127.0.0.1:8000"
      return
    fi

    if [ -f "${BACKEND_PID_FILE}" ] && ! is_pid_alive "${BACKEND_PID_FILE}"; then
      echo "❌ 后端启动失败，日志如下："
      cat "${BACKEND_LOG_FILE}"
      exit 1
    fi

    sleep 1
  done

  echo "❌ 45 秒内未探测到后端服务就绪，请检查日志：${BACKEND_LOG_FILE}" >&2
  echo "   当前启动脚本：${backend_start_script}" >&2
  exit 1
}

main() {
  local backend_start_script=""

  require_command "curl"
  backend_start_script="$(resolve_backend_start_script)"
  if [ ! -f "${backend_start_script}" ]; then
    echo "未找到后端启动脚本：${backend_start_script}" >&2
    exit 1
  fi
  if [ ! -f "${PUBLIC_TUNNEL_SCRIPT}" ]; then
    echo "未找到公共隧道脚本：${PUBLIC_TUNNEL_SCRIPT}" >&2
    exit 1
  fi

  start_backend_if_needed "${backend_start_script}"
  wait_for_backend_ready "${backend_start_script}"

  echo "🌍 正在启动公共隧道..."
  echo "   提示：按 Ctrl+C 只会关闭当前隧道，不会停止已在后台运行的后端。"
  exec bash "${PUBLIC_TUNNEL_SCRIPT}"
}

main "$@"
