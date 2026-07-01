#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import time
from pathlib import Path


EXTENSION_DIR = Path("/www/server/panel/vhost/nginx/extension/kaifaceshi.com")

# ── 腾讯云 CDN 官方回源 CIDR 清单（与 apply_nginx_realip_miioo_remote.py 保持一致）──
RAW_CIDRS = """
1.71.146.0/23
14.116.245.0/24
27.44.206.0/24
36.150.72.0/24
36.150.103.0/24
36.150.211.0/24
36.155.27.0/24
36.158.202.0/24
36.158.253.0/24
36.159.70.0/24
36.248.57.0/24
36.250.5.0/24
36.250.8.0/24
36.250.235.0/24
36.250.238.0/24
42.81.252.0/24
43.137.87.0/24
43.137.88.0/22
43.141.9.0/24
43.141.10.0/23
43.141.50.0/24
43.141.109.0/24
43.141.110.0/24
43.141.132.0/24
43.145.16.0/22
43.145.44.0/23
58.42.63.0/24
58.144.195.0/24
58.212.47.0/24
58.217.176.0/22
58.250.127.0/24
58.250.129.0/24
58.251.87.0/24
58.251.127.0/24
59.55.136.0/21
61.240.216.0/24
81.71.192.0/23
101.33.195.0/24
101.71.100.0/23
101.71.105.0/24
101.72.227.0/24
111.6.217.0/24
111.20.28.0/23
111.20.30.0/24
111.22.252.0/24
111.31.123.0/24
111.31.238.0/24
111.32.204.0/23
112.13.210.0/24
112.49.30.0/23
112.49.69.0/24
112.84.131.0/24
112.90.154.0/24
113.99.138.0/24
113.105.153.0/24
113.200.123.0/24
113.201.154.0/24
113.219.202.0/23
113.219.228.0/22
113.240.66.0/24
113.240.91.0/24
113.240.96.0/24
113.240.107.0/24
113.240.108.0/24
114.66.246.0/23
114.66.250.0/24
114.117.135.0/24
114.230.198.0/24
115.56.90.0/24
115.150.39.0/24
116.153.45.0/24
116.153.56.0/24
116.153.78.0/24
116.153.80.0/21
116.162.122.0/23
116.162.152.0/23
116.163.46.0/24
116.169.184.0/24
116.196.152.0/24
117.21.43.0/24
117.40.80.0/21
117.44.72.0/21
117.45.3.0/24
117.85.64.0/22
117.147.229.0/24
117.147.230.0/23
117.162.8.0/24
117.162.48.0/21
117.162.56.0/21
117.163.53.0/24
117.163.59.0/24
119.84.242.0/24
119.176.28.0/24
119.188.140.0/24
119.188.209.0/24
120.221.164.0/24
120.226.27.0/24
120.226.144.0/23
120.232.97.0/24
120.232.126.0/24
120.232.149.0/24
120.232.158.0/24
120.233.43.0/24
120.233.97.0/24
120.240.94.0/24
120.240.100.0/24
122.192.132.0/24
122.246.0.0/24
122.246.26.0/24
122.246.30.0/23
123.125.3.0/24
123.138.25.0/24
123.182.162.0/24
123.234.2.0/24
124.72.128.0/24
124.225.117.0/24
125.39.1.0/24
125.94.246.0/23
125.94.248.0/23
150.139.230.0/24
157.148.124.0/23
163.177.43.0/24
175.43.193.0/24
180.213.52.0/24
182.247.248.0/24
183.56.148.0/24
183.61.174.0/24
183.201.109.0/24
183.201.110.0/24
183.214.154.0/24
183.223.42.0/24
183.230.68.0/24
211.97.84.0/24
219.144.88.0/23
219.144.90.0/24
220.181.181.0/24
221.5.96.0/23
221.204.26.0/23
222.79.116.0/23
222.79.126.0/24
222.94.224.0/23
222.189.172.0/24
223.109.0.0/23
223.109.2.0/24
223.109.210.0/24
23.236.104.0/24
38.60.181.0/24
43.132.28.0/22
43.132.64.0/19
43.152.0.0/18
43.152.128.0/18
43.159.4.0/24
43.159.64.0/18
43.168.0.0/16
43.169.0.0/16
43.170.0.0/16
43.174.0.0/16
43.175.0.0/16
49.51.64.0/24
101.33.0.0/19
124.156.96.0/24
129.227.213.0/24
150.109.88.0/22
150.109.191.0/24
150.109.192.0/24
150.109.222.0/24
150.109.223.0/24
156.227.203.0/24
156.229.29.0/24
162.14.0.0/19
203.205.136.0/22
203.205.191.0/24
203.205.220.0/24
203.205.221.0/24
211.152.132.0/24
211.152.148.0/24
211.152.154.0/24
111.6.218.0/24
113.194.51.0/24
116.162.122.0/24
116.162.123.0/24
117.147.230.0/24
117.147.231.0/24
120.226.144.0/24
120.226.145.0/24
157.148.124.0/24
157.148.125.0/24
183.131.59.0/24
43.141.10.0/24
43.141.11.0/24
119.91.175.0/24
218.87.12.0/24
117.21.29.0/24
116.153.74.0/24
117.163.50.0/24
150.109.190.0/24
"""

# ── 各扩展配置文件内容 ──

REAL_IP_CONF_NAME = "real_ip_whitelist.conf"
API_PROXY_CONF_NAME = "api_proxy.conf"
SPA_FALLBACK_CONF_NAME = "spa_fallback.conf"
MEDIA_FALLBACK_CONF_NAME = "media_fallback.conf"
CACHE_CONF_NAME = "frontend_cdn_cache.conf"
HEADERS_CONF_NAME = "frontend_cdn_headers.conf"
GZIP_CONF_NAME = "frontend_cdn_gzip.conf"

API_PROXY_CONF_CONTENT = """# API proxy to backend start
location ^~ /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}
# API proxy to backend end
"""

SPA_FALLBACK_CONF_CONTENT = """# SPA fallback start
location / {
    try_files $uri $uri/ /index.html;
}
# SPA fallback end
"""

MEDIA_FALLBACK_CONF_CONTENT = """# Media fallback to www.miiooai.com start
location ^~ /uploads/ {
    return 302 https://www.miiooai.com$request_uri;
}

location ^~ /media/ {
    return 302 https://www.miiooai.com$request_uri;
}
# Media fallback to www.miiooai.com end
"""

CACHE_CONF_CONTENT = """# Frontend CDN cache rules start
# HTML - 不缓存（确保用户总是拿到最新版本）
location ~ \\.html$ {
    add_header Cache-Control "no-cache, must-revalidate, proxy-revalidate";
    add_header Pragma "no-cache";
    expires -1;
}

# JS/CSS with content hash - 长期缓存（Vite 构建产物带 hash，可永久缓存）
location ~ \\.[0-9a-f]{8,}\\.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Asset-Hash "true" always;
    expires 1y;
    access_log off;
}

# 普通 JS/CSS - 短期缓存
location ~ \\.(js|css)$ {
    add_header Cache-Control "public, max-age=7200";
    expires 2h;
    access_log off;
}

# 图片 - 长期缓存
location ~ \\.(gif|jpg|jpeg|png|bmp|svg|webp)$ {
    add_header Cache-Control "public, max-age=2592000";
    expires 30d;
    access_log off;
}

# 字体文件 - 长期缓存
location ~ \\.(woff2?|ttf|eot|otf)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    expires 1y;
    access_log off;
}

# favicon / robots.txt / sitemap - 短缓存
location ~ ^/(favicon\\.ico|robots\\.txt|sitemap\\.xml)$ {
    add_header Cache-Control "public, max-age=3600";
    expires 1h;
    access_log off;
}
# Frontend CDN cache rules end
"""

HEADERS_CONF_CONTENT = """# Frontend CDN compatibility headers start
# 让 CDN 正确区分 gzip/br 变体
add_header Vary "Accept-Encoding" always;

# 禁止 MIME 类型嗅探
add_header X-Content-Type-Options "nosniff" always;

# 限制 flv/swf 类型嗅探（仅旧浏览器）
add_header X-Permitted-Cross-Domain-Policies "none" always;

# 引用策略
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 跨域（允许 CDN 回源读取）
add_header Access-Control-Allow-Origin "*" always;
add_header Timing-Allow-Origin "*" always;

# CDN 层标记回源头（方便排障）
add_header X-Served-By "kaifaceshi-frontend" always;
# Frontend CDN compatibility headers end
"""

GZIP_CONF_CONTENT = """# Frontend CDN gzip compression start
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/atom+xml
    application/json
    application/ld+json
    application/manifest+json
    application/rss+xml
    application/vnd.geo+json
    application/x-web-app-manifest+json
    image/svg+xml
    application/x-font-ttf
    font/opentype;
# Frontend CDN gzip compression end
"""


def ordered_unique_cidrs() -> list[str]:
    seen: set[str] = set()
    cidrs: list[str] = []
    for cidr in re.findall(r"(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}", RAW_CIDRS):
        if cidr in seen:
            continue
        seen.add(cidr)
        cidrs.append(cidr)
    return cidrs


def build_real_ip_block() -> str:
    lines = [
        "# Tencent CDN real_ip whitelist start",
        "# Source: official origin-pull CIDRs provided on 2026-06-25.",
    ]
    lines.extend(f"set_real_ip_from {cidr};" for cidr in ordered_unique_cidrs())
    lines.extend(
        [
            "real_ip_header X-Forwarded-For;",
            "real_ip_recursive on;",
            "# Tencent CDN real_ip whitelist end",
            "",
        ]
    )
    return "\n".join(lines)


def backup_file(path: Path, timestamp: str) -> None:
    if not path.exists():
        return
    backup_path = path.with_name(f"{path.name}.bak.frontend_cdn_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def write_extension_files() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    EXTENSION_DIR.mkdir(parents=True, exist_ok=True)

    # 1. real_ip_whitelist.conf - 腾讯 CDN 回源 IP 白名单
    real_ip_path = EXTENSION_DIR / REAL_IP_CONF_NAME
    backup_file(real_ip_path, timestamp)
    real_ip_path.write_text(build_real_ip_block(), encoding="utf-8")
    print(f"updated={real_ip_path}")

    # 2-7. 其余 Nginx 扩展配置
    configs = [
        (API_PROXY_CONF_NAME, API_PROXY_CONF_CONTENT),
        (SPA_FALLBACK_CONF_NAME, SPA_FALLBACK_CONF_CONTENT),
        (MEDIA_FALLBACK_CONF_NAME, MEDIA_FALLBACK_CONF_CONTENT),
        (CACHE_CONF_NAME, CACHE_CONF_CONTENT),
        (HEADERS_CONF_NAME, HEADERS_CONF_CONTENT),
        (GZIP_CONF_NAME, GZIP_CONF_CONTENT),
    ]

    for name, content in configs:
        path = EXTENSION_DIR / name
        backup_file(path, timestamp)
        path.write_text(content, encoding="utf-8")
        print(f"updated={path}")


def verify() -> None:
    print("=== 验证 kaifaceshi.com 公网入口 ===")
    run("curl -k -I -s https://kaifaceshi.com/ | head -n 12")
    run("curl -k -I -s https://kaifaceshi.com/api/providers | head -n 8")
    print("=== 验证 kaifaceshi.com SPA 路由 ===")
    run("curl -k -I -s https://kaifaceshi.com/test-spa-route | head -n 8")
    print("=== 验证 kaifaceshi.com 媒体回退 ===")
    run("curl -k -I -s https://kaifaceshi.com/uploads/test.png | head -n 8 || true")
    run("curl -k -I -s https://kaifaceshi.com/media/origin/test.txt | head -n 8 || true")


def main() -> None:
    write_extension_files()
    run("nginx -t")
    run("nginx -s reload")
    verify()


if __name__ == "__main__":
    main()
