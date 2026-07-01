#!/bin/bash
# ──────────────────────────────────────────────────────────────
# 微信扫码登录线上链路自检脚本
#
# 用途：在服务器上快速确认「apex 回调入口 + 后端回调接口 + CORS」三段是否齐全，
#       定位「扫码后没登录成功」的根因到底在前端、后端还是 Nginx/域名。
#
# 用法：bash backend/scripts/check_wechat_login.sh
#
# 可覆盖的环境变量：
#   APEX_DOMAIN   前端页面 origin（微信回调域），默认 https://miiooai.com
#   API_DOMAIN    后端 API origin，默认 https://www.miiooai.com
# ──────────────────────────────────────────────────────────────
set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
info() { echo "       $*"; }

APEX_DOMAIN="${APEX_DOMAIN:-https://miiooai.com}"
API_DOMAIN="${API_DOMAIN:-https://www.miiooai.com}"

echo ""
echo "========================================================"
echo "  微信扫码登录线上链路自检"
echo "  前端页面 origin : $APEX_DOMAIN"
echo "  后端 API origin : $API_DOMAIN"
echo "========================================================"
echo ""

# ── 1. apex 根路径能否承接微信回调（带 code/state 不能 404）──────
echo "【1】apex 回调入口：$APEX_DOMAIN/?code=test&state=test"
APEX_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    "$APEX_DOMAIN/?code=test&state=test" 2>/dev/null || echo "ERR")
if [ "$APEX_CODE" = "200" ]; then
    ok "返回 200 — 微信跳回 apex 时能命中前端 SPA，由 Home.jsx 承接 code/state"
elif [ "$APEX_CODE" = "404" ]; then
    fail "返回 404 — 扫码后微信跳回 apex 直接 404，回调链路从这里就断了"
    info "→ 根因：apex 站点 miiooai.com 未把根路径回退到 index.html"
    info "→ 修复：部署 backend/nginx/miiooai-apex.conf 后 nginx -s reload"
else
    fail "返回 $APEX_CODE — apex 站点异常（SSL/防火墙/站点未发布）"
fi
echo ""

# ── 2. 后端微信回调接口是否可达（不校验业务，只看是否被路由到）────
echo "【2】后端回调接口：$API_DOMAIN/api/auth/wechat/callback/complete"
CB_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST "$API_DOMAIN/api/auth/wechat/callback/complete" \
    -H "Content-Type: application/json" \
    -d '{"code":"selfcheck","state":"selfcheck"}' 2>/dev/null || echo "ERR")
# 期望：接口存在 → 业务校验失败返回 4xx/5xx（如 404 会话不存在 / 400 微信授权失败）
# 不期望：Nginx 层 404（接口没被路由）或 502（后端没起来）
if [ "$CB_CODE" = "404" ] || [ "$CB_CODE" = "400" ] || [ "$CB_CODE" = "502" ]; then
    if [ "$CB_CODE" = "502" ]; then
        fail "返回 502 — Nginx 反代到的 FastAPI 没起来或端口不通"
        info "→ 修复：检查 uvicorn(:8000) 进程、supervisor/miioo-web 状态"
    else
        ok "返回 $CB_CODE — 接口已被路由到 FastAPI（业务层因测试参数拒绝，符合预期）"
        info "   ($CB_CODE 通常是「扫码会话不存在」或「微信授权失败」，说明链路通到了后端)"
    fi
elif [ "$CB_CODE" = "200" ]; then
    warn "返回 200 — 接口可达，但测试参数本应被拒绝，请留意后端校验逻辑"
else
    fail "返回 $CB_CODE — 接口未按预期可达"
    info "→ 若为 405/404 且确认路径无误，检查 API 站点反代规则与路由挂载"
fi
echo ""

# ── 3. CORS：apex 页面跨域请求 www 后端，预检是否放行 ─────────────
echo "【3】CORS 预检：Origin=$APEX_DOMAIN → $API_DOMAIN/api/auth/me"
CORS_HEADERS=$(curl -s -i -o /dev/null -D - --max-time 15 \
    -X OPTIONS "$API_DOMAIN/api/auth/me" \
    -H "Origin: $APEX_DOMAIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization" 2>/dev/null || echo "")
ALLOW_ORIGIN=$(echo "$CORS_HEADERS" | grep -i "access-control-allow-origin" | tr -d '\r')
if echo "$ALLOW_ORIGIN" | grep -qi "$APEX_DOMAIN"; then
    ok "预检放行 — $ALLOW_ORIGIN"
elif [ -n "$ALLOW_ORIGIN" ]; then
    warn "预检返回了 Allow-Origin，但与 apex 不一致：$ALLOW_ORIGIN"
    info "→ 检查 backend/.env 的 CORS_ORIGINS 是否含 $APEX_DOMAIN"
else
    fail "预检无 Access-Control-Allow-Origin — apex 页面调 www 后端会被浏览器拦截"
    info "→ 修复：CORS_ORIGINS 加入 $APEX_DOMAIN 后重启后端"
fi
echo ""

# ── 4. 后端运行时回调域配置（间接核对 redirect_uri 主机）──────────
echo "【4】扫码会话回调域核对（创建一次登录会话看二维码链接）"
QR_JSON=$(curl -s --max-time 15 "$API_DOMAIN/api/auth/wechat/qrcode" 2>/dev/null || echo "")
QR_VALUE=$(echo "$QR_JSON" | grep -o '"qr_code_value"[^,]*' | head -1)
if echo "$QR_VALUE" | grep -q "redirect_uri"; then
    REDIRECT_HOST=$(echo "$QR_VALUE" | grep -o 'redirect_uri[^&"]*' | head -1)
    ok "已生成微信授权链接"
    info "   $REDIRECT_HOST"
    info "→ 该 redirect_uri 解码后的主机，必须与微信开放平台「授权回调域」一致（apex: miiooai.com）"
elif echo "$QR_VALUE" | grep -q "miioo://"; then
    warn "返回的是开发态占位二维码（miioo://...），说明 WECHAT_LOGIN_ENABLED 未开启或配置不全"
    info "→ 检查线上 .env：WECHAT_LOGIN_ENABLED=true 且 APP_ID/SECRET/REDIRECT_URI 已配齐并重启"
else
    warn "未取到二维码链接，返回：$QR_JSON"
fi
echo ""

echo "========================================================"
echo "  自检完成"
echo ""
echo "  三段全 [OK] → 线上链路齐全，扫码登录应能跑通。"
echo "  若【1】404 → 部署 apex nginx：backend/nginx/miiooai-apex.conf"
echo "  若【3】FAIL → 补 CORS_ORIGINS 并重启后端"
echo "  若【4】WARN → 核对微信开放平台回调域 = miiooai.com（仅域名，不带路径）"
echo "========================================================"
echo ""
