#!/bin/bash

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${BACKEND_DIR}"

VENV_DIR="${VENV_DIR:-.venv}"
VENV_PYTHON="${VENV_DIR}/bin/python"
PYTHON_BIN="${PYTHON_BIN:-}"
DEV_RELOAD_MODE="${BACKEND_DEV_RELOAD:-auto}"
STRICT_VENV="${STRICT_VENV:-0}"
SELECTED_PYTHON=""

pick_python_bin() {
  if [ -n "${PYTHON_BIN}" ]; then
    if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
      echo "指定的 PYTHON_BIN 不存在: ${PYTHON_BIN}" >&2
      exit 1
    fi
    printf '%s' "${PYTHON_BIN}"
    return
  fi

  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      printf '%s' "${candidate}"
      return
    fi
  done

  echo "未检测到可用的 Python，请先安装 Python 3.12/3.11/3.10 后重试。" >&2
  exit 1
}

is_supported_python() {
  "$1" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] <= (3, 13) else 1)'
}

python_version() {
  "$1" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")'
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "未检测到必需命令: $1" >&2
    exit 1
  fi
}

find_listening_processes_by_port() {
  local port="${1:-}"
  [ -n "${port}" ] || return 0

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | tail -n +2 || true
    return 0
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -anv -p tcp 2>/dev/null | grep "[\.\:]${port}[[:space:]].*LISTEN" || true
  fi
}

exit_if_service_port_in_use() {
  local host="${1:-0.0.0.0}"
  local port="${2:-8000}"
  local existing_listeners=""

  existing_listeners="$(find_listening_processes_by_port "${port}")"
  if [ -z "${existing_listeners}" ]; then
    return
  fi

  echo "检测到端口 ${port} 已被占用，跳过重复启动。" >&2
  echo "当前监听进程：" >&2
  printf '%s\n' "${existing_listeners}" >&2
  echo "如需改用其他端口，请先停止现有服务或修改启动脚本端口配置。" >&2
  echo "当前服务地址通常为: http://127.0.0.1:${port}" >&2
  exit 0
}

is_trae_sandbox() {
  [ -n "${TRAE_SANDBOX_CLI_PATH:-}" ] || [ "${AI_AGENT:-}" = "TRAE" ]
}

resolve_reload_mode() {
  case "${DEV_RELOAD_MODE}" in
    on | off)
      printf '%s' "${DEV_RELOAD_MODE}"
      ;;
    auto | "")
      if is_trae_sandbox; then
        printf '%s' "off"
      else
        printf '%s' "on"
      fi
      ;;
    *)
      echo "不支持的 BACKEND_DEV_RELOAD=${DEV_RELOAD_MODE}，可选值: auto / on / off" >&2
      exit 1
      ;;
  esac
}

ensure_selected_python() {
  if [ -n "${SELECTED_PYTHON}" ]; then
    return
  fi

  SELECTED_PYTHON="$(pick_python_bin)"

  if ! is_supported_python "${SELECTED_PYTHON}"; then
    echo "当前可用的 ${SELECTED_PYTHON} 为 $(python_version "${SELECTED_PYTHON}")，但本地依赖暂不兼容 Python 3.14+。" >&2
    echo "请先安装 Python 3.12/3.11/3.10，或通过 PYTHON_BIN 显式指定受支持版本后重试。" >&2
    exit 1
  fi
}

ensure_venv() {
  ensure_selected_python

  if [ -x "${VENV_PYTHON}" ] && ! is_supported_python "${VENV_PYTHON}"; then
    if [ "${STRICT_VENV}" = "1" ]; then
      echo "检测到固定虚拟环境 ${VENV_DIR} 使用 Python $(python_version "${VENV_PYTHON}")，当前脚本不允许自动重建。" >&2
      echo "请先在服务器上重建该虚拟环境后再启动。" >&2
      exit 1
    fi
    echo "检测到现有 ${VENV_DIR} 使用 Python $(python_version "${VENV_PYTHON}")，正在改用 ${SELECTED_PYTHON} 重建..."
    rm -rf "${VENV_DIR}"
  fi

  if [ ! -x "${VENV_PYTHON}" ]; then
    if [ "${STRICT_VENV}" = "1" ]; then
      echo "未检测到固定虚拟环境: ${VENV_DIR}" >&2
      echo "当前脚本处于线上固定虚拟环境模式，不会自动创建或安装依赖。" >&2
      echo "请先在服务器准备好该虚拟环境，例如：" >&2
      echo "  python3.12 -m venv ${VENV_DIR}" >&2
      echo "  ${VENV_DIR}/bin/pip install -r requirements.txt" >&2
      exit 1
    fi
    echo "未检测到可用的 ${VENV_DIR}，正在使用 ${SELECTED_PYTHON} 创建本地虚拟环境..."
    if ! "${SELECTED_PYTHON}" -m venv "${VENV_DIR}"; then
      echo "创建 ${VENV_DIR} 失败，请先安装 Python venv 组件后重试。" >&2
      echo "Ubuntu 通常需要先执行: sudo apt install python3.10-venv" >&2
      exit 1
    fi

    echo "正在安装后端依赖..."
    "${VENV_PYTHON}" -m pip install --upgrade pip
    "${VENV_PYTHON}" -m pip install -r requirements.txt
  fi
}

ensure_backend_runtime() {
  ensure_venv

  if ! "${VENV_PYTHON}" -c "import uvicorn" >/dev/null 2>&1; then
    if [ "${STRICT_VENV}" = "1" ]; then
      echo "固定虚拟环境 ${VENV_DIR} 缺少 uvicorn 或后端依赖，当前脚本不自动补装。" >&2
      echo "请先执行：${VENV_DIR}/bin/pip install -r requirements.txt" >&2
      exit 1
    fi
    echo "检测到 ${VENV_DIR} 缺少 uvicorn，正在补装后端依赖..."
    "${VENV_PYTHON}" -m pip install --upgrade pip
    "${VENV_PYTHON}" -m pip install -r requirements.txt
  fi
}

ensure_local_database_migrations() {
  ensure_backend_runtime

  if [ ! -f "alembic.ini" ]; then
    echo "未检测到 alembic.ini，跳过本地数据库迁移自检。"
    return
  fi

  local head_revisions=""
  local current_revisions=""
  local head_output=""
  local current_output=""

  if ! head_output="$("${VENV_PYTHON}" -m alembic heads 2>&1)"; then
    echo "读取 alembic heads 失败，无法确认本地迁移目标版本：" >&2
    printf '%s\n' "${head_output}" >&2
    exit 1
  fi

  head_revisions="$(printf '%s\n' "${head_output}" | awk '/^[0-9a-z]+/ {print $1}' | sort | paste -sd ',' -)"
  if [ -z "${head_revisions}" ]; then
    echo "未读取到 alembic heads，跳过本地数据库迁移自检。"
    return
  fi

  if ! current_output="$("${VENV_PYTHON}" -m alembic current 2>&1)"; then
    echo "读取 alembic current 失败，当前无法连接本地数据库或数据库配置不可用：" >&2
    printf '%s\n' "${current_output}" >&2
    echo "如需自动拉起本地 PostgreSQL 并继续启动后端，可改用：" >&2
    echo "  ./脚本/start_db_and_server.sh" >&2
    echo "或在仓库根目录执行：" >&2
    echo "  ./start_backend.sh db" >&2
    exit 1
  fi

  current_revisions="$(printf '%s\n' "${current_output}" | awk '/^[0-9a-z]+/ {print $1}' | sort | paste -sd ',' -)"
  if [ "${current_revisions}" = "${head_revisions}" ]; then
    return
  fi

  echo "检测到本地数据库未追上最新迁移："
  echo "  current: ${current_revisions:-<empty>}"
  echo "  heads:   ${head_revisions}"
  echo "正在执行本地数据库迁移..."

  if "${VENV_PYTHON}" -m alembic upgrade head; then
    echo "本地数据库已升级到最新迁移。"
    return
  fi

  echo "自动迁移失败，请先检查当前数据库是否属于“已有初始化表结构但 alembic_version 为空”的历史库。" >&2
  echo "如命中该场景，可先手工执行：" >&2
  echo "  ${VENV_PYTHON} -m alembic stamp head" >&2
  echo "然后再执行：" >&2
  echo "  ${VENV_PYTHON} -m alembic upgrade head" >&2
  exit 1
}

normalize_database_url_for_psql() {
  ensure_selected_python

  DB_URL="$1" "${SELECTED_PYTHON}" - <<'PY'
from urllib.parse import urlparse
import os

url = os.environ["DB_URL"].replace("+asyncpg", "")
parsed = urlparse(url)
print(parsed.geturl())
PY
}

run_uvicorn_with_reload_policy() {
  local app_module="${1:-app.main:app}"
  local host="${2:-0.0.0.0}"
  local port="${3:-8000}"
  local script_hint="${4:-./start.sh}"
  local reload_mode

  reload_mode="$(resolve_reload_mode)"
  exit_if_service_port_in_use "${host}" "${port}"

  if [ "${reload_mode}" = "on" ]; then
    echo "当前以后端开发热重载模式启动（BACKEND_DEV_RELOAD=${DEV_RELOAD_MODE:-auto}）..."
    exec "${VENV_PYTHON}" -m uvicorn "${app_module}" \
      --host "${host}" \
      --port "${port}" \
      --reload \
      --reload-dir app \
      --reload-exclude '.venv/*' \
      --reload-exclude '__pycache__/*' \
      --reload-exclude '*.pyc' \
      --reload-exclude '.venv/**'
  fi

  if [ "${DEV_RELOAD_MODE:-auto}" = "auto" ] && is_trae_sandbox; then
    echo "检测到 Trae sandbox 终端环境，自动关闭 --reload 以规避 watchfiles 子进程卡住。"
    echo "如需强制启用热重载，可显式执行: BACKEND_DEV_RELOAD=on ${script_hint}"
  else
    echo "当前以后端稳定模式启动（BACKEND_DEV_RELOAD=${DEV_RELOAD_MODE:-auto}，不启用 --reload）..."
  fi

  exec "${VENV_PYTHON}" -m uvicorn "${app_module}" \
    --host "${host}" \
    --port "${port}"
}
