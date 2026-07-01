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
WEB_LOG_FILE="${WEB_LOG_FILE:-${BACKEND_DIR}/logs/supervisor/web.log}"
WORKER_LOG_FILE="${WORKER_LOG_FILE:-${BACKEND_DIR}/logs/supervisor/worker.log}"
MEDIA_AUDIT_TARGET="${MEDIA_AUDIT_TARGET:-web}"
LINES="${1:-200}"

if [ ! -f "${WEB_LOG_FILE}" ] && [ -f "${BACKEND_DIR}/backend/logs/supervisor/web.log" ]; then
  WEB_LOG_FILE="${BACKEND_DIR}/backend/logs/supervisor/web.log"
fi

if [ ! -f "${WORKER_LOG_FILE}" ] && [ -f "${BACKEND_DIR}/backend/logs/supervisor/worker.log" ]; then
  WORKER_LOG_FILE="${BACKEND_DIR}/backend/logs/supervisor/worker.log"
fi

if ! [[ "${LINES}" =~ ^[0-9]+$ ]] || [ "${LINES}" -le 0 ]; then
  fail "行数参数必须是正整数，当前收到: ${LINES}"
  exit 1
fi

resolve_log_file() {
  case "${1:-}" in
    web)
      printf '%s' "${WEB_LOG_FILE}"
      ;;
    worker)
      printf '%s' "${WORKER_LOG_FILE}"
      ;;
    *)
      return 1
      ;;
  esac
}

collect_targets() {
  case "${MEDIA_AUDIT_TARGET}" in
    web)
      printf '%s\n' "web"
      ;;
    worker)
      printf '%s\n' "worker"
      ;;
    all)
      printf '%s\n' "web" "worker"
      ;;
    *)
      fail "MEDIA_AUDIT_TARGET 仅支持 web / worker / all，当前收到: ${MEDIA_AUDIT_TARGET}"
      exit 1
      ;;
  esac
}

TMP_AUDIT="$(mktemp)"
trap 'rm -f "${TMP_AUDIT}"' EXIT

echo ""
echo "========================================================"
echo "  统一媒体下载审计巡检"
echo "  target : ${MEDIA_AUDIT_TARGET}"
echo "  lines  : ${LINES}"
echo "========================================================"
echo ""

FOUND_LOG=0
while IFS= read -r target; do
  [ -n "${target}" ] || continue
  log_file="$(resolve_log_file "${target}")"
  if [ -f "${log_file}" ]; then
    FOUND_LOG=1
    ok "${target} 日志存在：${log_file}"
    tail -n "${LINES}" "${log_file}" | grep "app.media_download" >> "${TMP_AUDIT}" || true
  else
    warn "${target} 日志不存在：${log_file}"
  fi
done < <(collect_targets)
echo ""

if [ "${FOUND_LOG}" -eq 0 ]; then
  warn "未找到任何可读取的日志文件"
  info "可通过 BACKEND_DIR / WEB_LOG_FILE / WORKER_LOG_FILE 覆盖日志路径"
  exit 0
fi

if [ ! -s "${TMP_AUDIT}" ]; then
  warn "最近 ${LINES} 行日志中没有发现 app.media_download 审计记录"
  info "若刚完成下载联调，可先执行 ./project_ops.sh follow web 观察实时日志"
  info "若确认已有下载流量，再检查日志路径是否指向当前 Supervisor 输出"
  exit 0
fi

TOTAL_LINES="$(wc -l < "${TMP_AUDIT}" | tr -d ' ')"
ok "命中下载审计日志 ${TOTAL_LINES} 条"
echo ""

echo "【1】按 outcome 汇总"
awk '
{
  outcome="-"
  for (i = 1; i <= NF; i++) {
    if ($i ~ /^outcome=/) {
      outcome = substr($i, 9)
      break
    }
  }
  print outcome
}
' "${TMP_AUDIT}" | sort | uniq -c | sort -nr | awk '{printf "  - %-20s %s\n", $2, $1}'
echo ""

echo "【2】按 event + outcome 汇总"
awk '
{
  event="-"
  outcome="-"
  for (i = 1; i <= NF; i++) {
    if ($i ~ /^event=/) {
      event = substr($i, 7)
    } else if ($i ~ /^outcome=/) {
      outcome = substr($i, 9)
    }
  }
  print event "\t" outcome
}
' "${TMP_AUDIT}" | sort | uniq -c | sort -nr | awk '{printf "  - %-28s %-20s %s\n", $2, $3, $1}'
echo ""

FAILURE_LINES="$(grep -E 'outcome=(invalid_token|forbidden|not_found|rejected)' "${TMP_AUDIT}" || true)"
if [ -n "${FAILURE_LINES}" ]; then
  warn "发现失败类审计事件"
  echo ""
  echo "【3】最近失败样本（最多 20 条）"
  printf '%s\n' "${FAILURE_LINES}" | tail -n 20
  echo ""
  echo "【4】失败 resource_id Top"
  printf '%s\n' "${FAILURE_LINES}" \
    | sed -n 's/.*resource_id=\([^ ]*\).*/\1/p' \
    | grep -v '^-*$' \
    | sort \
    | uniq -c \
    | sort -nr \
    | head -n 10 \
    | awk '{printf "  - %-36s %s\n", $2, $1}'
  echo ""
  info "排障建议：先对照 docs/runbooks/media-download-signing.md 的“快速判断”和“处理步骤”执行"
else
  ok "最近日志中未发现 invalid_token / forbidden / not_found / rejected"
  echo ""
fi

echo "【5】最近 10 条原始审计日志"
tail -n 10 "${TMP_AUDIT}"
echo ""
echo "========================================================"
echo "  巡检完成"
echo "  更多排障步骤：docs/runbooks/media-download-signing.md"
echo "========================================================"
echo ""
