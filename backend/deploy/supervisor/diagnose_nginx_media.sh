#!/bin/bash
# =============================================================================
# Nginx 媒体服务诊断脚本
# 用途：自动排查云端图片/视频/音频破图、404、502 等问题
# 用法：bash diagnose_nginx_media.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

NL=$'\n'
ISSUES=()
PASSES=()

log_pass()  { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSES+=("$1"); }
log_warn()  { echo -e "  ${YELLOW}[WARN]${NC} $1"; ISSUES+=("WARN: $1"); }
log_fail()  { echo -e "  ${RED}[FAIL]${NC} $1"; ISSUES+=("FAIL: $1"); }
log_info()  { echo -e "  ${CYAN}[INFO]${NC} $1"; }

NGINX_VHOST_DIR="/www/server/panel/vhost/nginx"
CANDIDATE_BACKEND_DIRS=(
    "/www/wwwroot/miiooaib.com/backend"
    "/www/wwwroot/chengxvblog.top/backend"
)

echo "================================================================"
echo "  Nginx 媒体服务诊断"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

# ────────────────────────────────────────────────────
# 1. Nginx 语法 + 冲突检测
# ────────────────────────────────────────────────────
echo ""
echo "── 1. Nginx 配置语法与冲突检测 ──"

if nginx -t 2>&1 | tee /tmp/nginx_test_output.txt | grep -q "syntax is ok"; then
    log_pass "Nginx 语法检查通过"
else
    log_fail "Nginx 语法检查失败，请先修复后再继续排查"
    cat /tmp/nginx_test_output.txt
    exit 1
fi

if grep -q "conflicting server name" /tmp/nginx_test_output.txt; then
    log_fail "存在冲突的 server_name 声明（同名域名被多个 server 块托管）"
    echo ""
    grep "conflicting server name" /tmp/nginx_test_output.txt
    echo ""
    echo "  冲突域名列表："
    grep "conflicting server name" /tmp/nginx_test_output.txt | grep -oP '"[^"]+"' | sort -u
    echo ""
    log_info "建议：用以下命令找出冲突的配置文件，将域名从其中一个 server 块中移除"
    echo "  grep -rn '<冲突域名>' $NGINX_VHOST_DIR/*.conf"
else
    log_pass "无 server_name 冲突"
fi

# ────────────────────────────────────────────────────
# 2. server_name 与 /uploads/ /media/ 映射关系
# ────────────────────────────────────────────────────
echo ""
echo "── 2. 域名 → /uploads/ /media/ 路由映射 ──"

for conf in "$NGINX_VHOST_DIR"/*.conf; do
    [ -f "$conf" ] || continue
    conf_name=$(basename "$conf")
    server_names=$(grep -oP 'server_name\s+\K[^;]+' "$conf" 2>/dev/null || true)
    [ -z "$server_names" ] && continue

    echo ""
    log_info "配置文件: $conf_name"
    echo "    server_name: $server_names"

    # 检查 /uploads/
    if grep -q 'location.*/uploads/' "$conf" 2>/dev/null; then
        uploads_line=$(grep -n 'location.*/uploads/' "$conf" | head -1)
        echo "    /uploads/: 第 ${uploads_line%%:*} 行"

        if grep -A5 'location.*/uploads/' "$conf" | grep -q 'alias\|proxy_pass\|return 302'; then
            action=$(grep -A5 'location.*/uploads/' "$conf" | grep -oP '(alias|proxy_pass|return 302)\s+\K[^;]+' | head -1)
            echo "      → $action"
        fi

        # 对于 alias，检查目标目录是否存在
        alias_path=$(grep -A5 'location.*/uploads/' "$conf" | grep -oP 'alias\s+\K[^;]+' | head -1 || true)
        if [ -n "$alias_path" ]; then
            alias_path=$(echo "$alias_path" | xargs)
            if [ -d "$alias_path" ]; then
                file_count=$(find "$alias_path" -type f 2>/dev/null | wc -l)
                echo "      → 目录存在，包含 $file_count 个文件"
            else
                log_fail "alias 目标目录不存在: $alias_path"
            fi
        fi
    else
        log_warn "缺少 /uploads/ location 块（图片/视频可能无法访问）"
    fi

    # 检查 /media/
    if grep -q 'location.*/media/' "$conf" 2>/dev/null; then
        media_line=$(grep -n 'location.*/media/' "$conf" | head -1)
        echo "    /media/: 第 ${media_line%%:*} 行"
    else
        log_info "无 /media/ location 块"
    fi

    # 检查 HSTS
    if grep -q 'Strict-Transport-Security' "$conf" 2>/dev/null; then
        log_info "已启用 HSTS"
    fi
done

# ────────────────────────────────────────────────────
# 3. 后端配置检查
# ────────────────────────────────────────────────────
echo ""
echo "── 3. 后端 .env 配置检查 ──"

BACKEND_DIR=""
for candidate in "${CANDIDATE_BACKEND_DIRS[@]}"; do
    if [ -f "$candidate/.env" ]; then
        BACKEND_DIR="$candidate"
        break
    fi
done

if [ -z "$BACKEND_DIR" ]; then
    log_warn "未找到后端 .env 文件，请手动指定 BACKEND_DIR"
else
    log_info "后端目录: $BACKEND_DIR"

    # UPLOAD_DIR
    upload_dir=$(grep -oP '^UPLOAD_DIR=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    if [ -z "$upload_dir" ]; then
        log_warn "UPLOAD_DIR 未设置"
    else
        log_info "UPLOAD_DIR=$upload_dir"
    fi

    # SERVE_UPLOADS_VIA_APP
    serve_uploads=$(grep -oP '^SERVE_UPLOADS_VIA_APP=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    if [ "$serve_uploads" = "true" ]; then
        log_warn "SERVE_UPLOADS_VIA_APP=true（FastAPI 直接服务上传，应与 Nginx 互斥）"
    elif [ "$serve_uploads" = "false" ]; then
        log_pass "SERVE_UPLOADS_VIA_APP=false（Nginx 服务上传）"
    else
        log_info "SERVE_UPLOADS_VIA_APP 未设置（默认 true）"
    fi

    # MEDIA_STORAGE_MODE
    storage_mode=$(grep -oP '^MEDIA_STORAGE_MODE=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    log_info "MEDIA_STORAGE_MODE=$storage_mode"

    # PUBLIC_BASE_URL
    public_base=$(grep -oP '^PUBLIC_BASE_URL=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    log_info "PUBLIC_BASE_URL=$public_base"

    # MEDIA_PUBLIC_BASE_URL
    media_public=$(grep -oP '^MEDIA_PUBLIC_BASE_URL=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    log_info "MEDIA_PUBLIC_BASE_URL=$media_public"

    # MEDIA_CDN_BASE_URL
    media_cdn=$(grep -oP '^MEDIA_CDN_BASE_URL=\K.*' "$BACKEND_DIR/.env" 2>/dev/null | head -1 || echo "")
    log_info "MEDIA_CDN_BASE_URL=$media_cdn"

    # Supervisor 环境变量（补充检查）
    supervisor_conf="/etc/supervisord.d/miioo-backend.ini"
    if [ -f "$supervisor_conf" ]; then
        if grep -q 'SERVE_UPLOADS_VIA_APP' "$supervisor_conf"; then
            log_info "Supervisor 已显式设置 SERVE_UPLOADS_VIA_APP"
        else
            log_warn "Supervisor 未设置 SERVE_UPLOADS_VIA_APP，完全依赖 .env 文件"
        fi
    fi
fi

# ────────────────────────────────────────────────────
# 4. 上传目录存在性与权限
# ────────────────────────────────────────────────────
echo ""
echo "── 4. 上传目录检查 ──"

if [ -n "$upload_dir" ]; then
    resolved_dir="$upload_dir"
    if [[ ! "$resolved_dir" = /* ]]; then
        resolved_dir="$BACKEND_DIR/$upload_dir"
    fi

    if [ -d "$resolved_dir" ]; then
        file_count=$(find "$resolved_dir" -type f 2>/dev/null | wc -l)
        log_pass "上传目录存在: $resolved_dir ($file_count 个文件)"
        echo "    子目录结构:"
        find "$resolved_dir" -maxdepth 3 -type d 2>/dev/null | head -20 | while read d; do
            count=$(find "$d" -maxdepth 1 -type f 2>/dev/null | wc -l)
            echo "      $d  ($count files)"
        done

        # 权限检查
        dir_owner=$(stat -c '%U' "$resolved_dir" 2>/dev/null || true)
        if [ "$dir_owner" != "www" ] && [ "$dir_owner" != "nginx" ]; then
            log_warn "上传目录 owner 为 $dir_owner，Nginx(www) 可能无法读取"
        else
            log_pass "上传目录 owner: $dir_owner"
        fi
    else
        log_fail "上传目录不存在: $resolved_dir"
    fi
fi

# ────────────────────────────────────────────────────
# 5. Nginx 错误日志最近 10 条 404
# ────────────────────────────────────────────────────
echo ""
echo "── 5. 最近的 Nginx 404 错误（文件不存在） ──"

LOG_FILES=(
    "/www/wwwlogs/miiooaib.com.error.log"
    "/www/wwwlogs/miioo.com.error.log"
    "/www/wwwlogs/nginx_error.log"
)

for logfile in "${LOG_FILES[@]}"; do
    [ -f "$logfile" ] || continue
    count=$(grep -c 'No such file or directory' "$logfile" 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
        echo "  文件: $logfile (共 $count 条 404)"
        grep 'No such file or directory' "$logfile" 2>/dev/null | tail -5 | while read line; do
            # 提取请求的路径
            path=$(echo "$line" | grep -oP '"/[^"]+"' | tail -1 | tr -d '"')
            echo "    → $path"
        done
    fi
done

# ────────────────────────────────────────────────────
# 6. CDN 层干扰检测（Lego Server / EdgeOne）
# ────────────────────────────────────────────────────
echo ""
echo "── 6. CDN 层检测 ──"

# 用第一个可用的测试文件
TEST_URL=""
for conf in "$NGINX_VHOST_DIR"/*.conf; do
    [ -f "$conf" ] || continue
    domain=$(grep -oP 'server_name\s+\K[^\s;]+' "$conf" | head -1 || true)
    [ -z "$domain" ] && continue

    # 尝试构造测试 URL
    if [ -n "$upload_dir" ] && [ -d "${resolved_dir:-}" ]; then
        test_file=$(find "${resolved_dir}" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) 2>/dev/null | head -1)
        if [ -n "$test_file" ]; then
            rel_path="${test_file#$resolved_dir/}"
            TEST_URL="https://$domain/uploads/$rel_path"
            break
        fi
    fi
done

if [ -n "$TEST_URL" ]; then
    log_info "测试 URL: $TEST_URL"

    # CDN 层测试
    response=$(curl -s -o /dev/null -w "%{http_code}" -I --max-time 10 "$TEST_URL" 2>/dev/null || echo "000")
    server_header=$(curl -s -I --max-time 10 "$TEST_URL" 2>/dev/null | grep -i '^server:' | head -1 || echo "")

    if echo "$server_header" | grep -qi "Lego Server"; then
        log_warn "响应来自 EdgeOne CDN (Lego Server)，而非源站 Nginx"
        if [ "$response" = "405" ]; then
            log_fail "CDN 返回 405（HEAD 方法被拦截），图片在公网不可访问！"
            log_info "建议：在 EdgeOne 控制台关闭对应域名的 HEAD 方法拦截"
        elif [ "$response" = "200" ]; then
            log_pass "CDN 返回 200，公网可访问"
        else
            log_warn "CDN 返回 HTTP $response"
        fi
    else
        log_info "响应来自: $server_header"
        if [ "$response" = "200" ]; then
            log_pass "图片公网可访问 (HTTP 200)"
        elif [ "$response" = "404" ]; then
            log_fail "图片公网 404 — 文件不存在或 Nginx alias 路径错误"
        elif [ "$response" = "302" ] || [ "$response" = "301" ]; then
            redirect_to=$(curl -s -I --max-time 10 "$TEST_URL" 2>/dev/null | grep -i '^location:' | head -1)
            log_fail "图片返回重定向 $response → $redirect_to（可能存在死循环或跨域跳转）"
        else
            log_warn "图片返回 HTTP $response"
        fi
    fi

    # 绕CDN直连源站测试
    log_info "绕CDN直连源站测试:"
    local_response=$(curl -s -o /dev/null -w "%{http_code}" -k --max-time 10 --resolve "$domain:443:127.0.0.1" "$TEST_URL" 2>/dev/null || echo "000")
    if [ "$local_response" = "200" ]; then
        log_pass "源站 Nginx 直接返回 200 — 问题可能在 CDN 层"
    elif [ "$local_response" = "302" ]; then
        log_fail "源站 Nginx 返回 302 — 存在死循环重定向"
    else
        log_fail "源站 Nginx 返回 $local_response"
    fi
else
    log_warn "未找到可用的测试图片文件"
fi

# ────────────────────────────────────────────────────
# 汇总
# ────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  诊断汇总"
echo "================================================================"

if [ ${#ISSUES[@]} -eq 0 ]; then
    echo -e "${GREEN}未发现问题！${NC}"
else
    echo -e "${RED}发现 ${#ISSUES[@]} 个问题：${NC}"
    for issue in "${ISSUES[@]}"; do
        echo -e "  ${RED}•${NC} $issue"
    done
fi

echo ""
echo "通过项: ${#PASSES[@]}"
echo ""
echo "================================================================"
