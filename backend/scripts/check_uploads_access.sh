#!/bin/bash
# ──────────────────────────────────────────────────────────────
# 云端 /uploads/ 访问链路诊断脚本
#
# 用途：快速定位 Seedance 参考视频 404 的根因
# 用法：bash backend/scripts/check_uploads_access.sh [视频路径]
#
# 示例：
#   bash backend/scripts/check_uploads_access.sh \
#     /uploads/creation/sessions/xxx/shots/yyy/uploads/zzz.mp4
# ──────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
info() { echo "       $*"; }

# ── 配置（可按实际环境修改）──────────────────────────────────
BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
UPLOAD_DIR="${UPLOAD_DIR:-$BACKEND_DIR/uploads}"
FASTAPI_HOST="${FASTAPI_HOST:-127.0.0.1}"
FASTAPI_PORT="${FASTAPI_PORT:-8000}"
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-https://www.miiooai.com}"

TEST_PATH="${1:-}"

echo ""
echo "========================================================"
echo "  miiooai /uploads/ 访问链路诊断"
echo "========================================================"
echo ""

# ── 1. 检查 uploads 目录是否存在 ────────────────────────────
echo "【1】检查 uploads 目录"
if [ -d "$UPLOAD_DIR" ]; then
    FILE_COUNT=$(find "$UPLOAD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    ok "目录存在：$UPLOAD_DIR（文件数：$FILE_COUNT）"
else
    fail "目录不存在：$UPLOAD_DIR"
    info "请检查 backend/.env 中的 UPLOAD_DIR 配置"
fi
echo ""

# ── 2. 如果传入了具体文件路径，检查文件是否存在 ──────────────
if [ -n "$TEST_PATH" ]; then
    echo "【2】检查目标文件是否存在"
    REL_PATH="${TEST_PATH#/uploads/}"
    FILE_FULL="$UPLOAD_DIR/$REL_PATH"
    if [ -f "$FILE_FULL" ]; then
        SIZE=$(du -sh "$FILE_FULL" 2>/dev/null | cut -f1)
        ok "文件存在：$FILE_FULL（大小：$SIZE）"
    else
        fail "文件不存在：$FILE_FULL"
        info "→ 根因：uploads 目录未持久化，或文件上传到了其他路径"
        info "→ 修复：挂载持久化 volume，或重新上传素材"
    fi
    echo ""
fi

# ── 3. 检查应用层兜底是否在线（仅用于开发/排障）────────────────
echo "【3】检查应用层兜底（127.0.0.1:$FASTAPI_PORT）"
if curl -sf --max-time 5 "http://$FASTAPI_HOST:$FASTAPI_PORT/api/health" > /dev/null 2>&1 || \
   curl -sf --max-time 5 "http://$FASTAPI_HOST:$FASTAPI_PORT/" > /dev/null 2>&1; then
    ok "FastAPI / 应用层入口可访问（$FASTAPI_HOST:$FASTAPI_PORT）"
else
    warn "应用层健康检查无响应，继续检查静态目录与公网链路..."
fi

if [ -n "$TEST_PATH" ]; then
    INNER_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        "http://$FASTAPI_HOST:$FASTAPI_PORT$TEST_PATH" 2>/dev/null || echo "ERR")
    if [ "$INNER_CODE" = "200" ] || [ "$INNER_CODE" = "206" ]; then
        ok "应用层兜底返回 $INNER_CODE（当前仍可直接伺服该文件）"
    else
        warn "应用层兜底返回 $INNER_CODE（路径：$TEST_PATH）"
        info "→ 生产环境若已设置 SERVE_UPLOADS_VIA_APP=false，这里非 200/206 可接受"
        info "→ 若开发环境也异常，再检查 UPLOAD_DIR 配置或 FastAPI 是否启动"
    fi
fi
echo ""

# ── 4. 检查公网 /uploads/ 是否可访问 ────────────────────────
if [ -n "$TEST_PATH" ]; then
    echo "【4】检查公网访问（$PUBLIC_DOMAIN$TEST_PATH）"
    OUTER_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
        "$PUBLIC_DOMAIN$TEST_PATH" 2>/dev/null || echo "ERR")
    if [ "$OUTER_CODE" = "200" ] || [ "$OUTER_CODE" = "206" ]; then
        ok "公网返回 $OUTER_CODE ✓ 访问链路正常，无需修复 Nginx"
    elif [ "$OUTER_CODE" = "404" ]; then
        fail "公网返回 404"
        info "→ 优先检查 Nginx 的 location /uploads/ 是否为 alias 直出"
        info "→ 再检查 alias 路径是否与 backend/.env 的 UPLOAD_DIR 一致"
    else
        fail "公网返回 $OUTER_CODE"
        info "→ 请检查 Nginx、SSL 证书或防火墙配置"
    fi
    echo ""
fi

# ── 5. 检查 Nginx 是否运行 ───────────────────────────────────
echo "【5】检查 Nginx 状态"
if command -v nginx > /dev/null 2>&1; then
    if nginx -t 2>/dev/null; then
        ok "Nginx 配置语法正确"
    else
        fail "Nginx 配置有语法错误，请运行：sudo nginx -t"
    fi
    if pgrep -x nginx > /dev/null 2>&1; then
        ok "Nginx 进程正在运行"
    else
        fail "Nginx 未运行"
    fi
else
    warn "未找到 nginx 命令（可能未安装或不在 PATH 中）"
fi
echo ""

echo "========================================================"
echo "  诊断完成"
echo ""
echo "  如需修复 Nginx，执行："
echo "    sudo cp backend/nginx/miiooai.conf /etc/nginx/sites-available/miiooai.conf"
echo "    sudo ln -sf /etc/nginx/sites-available/miiooai.conf /etc/nginx/sites-enabled/"
echo "    sudo nginx -t && sudo nginx -s reload"
echo "========================================================"
echo ""
