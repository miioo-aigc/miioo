#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path


EXTENSION_DIR = Path("/www/server/panel/vhost/nginx/extension/miioo.com")

CACHE_CONF_NAME = "frontend_cdn_cache.conf"
HEADERS_CONF_NAME = "frontend_cdn_headers.conf"
GZIP_CONF_NAME = "frontend_cdn_gzip.conf"

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
add_header X-Served-By "miioo-frontend" always;
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

    configs = [
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
    print("=== 验证 miiooai.com 公网入口 ===")
    run("curl -k -I -s https://miiooai.com/ | head -n 12")
    run("curl -k -I -s https://miiooai.com/api/providers | head -n 8")
    print("=== 验证 miiooai.com SPA 路由 ===")
    run("curl -k -I -s https://miiooai.com/non-existent-spa-route-test | head -n 8")
    print("=== 验证 miiooai.com 媒体回退 ===")
    run("curl -k -I -s https://miiooai.com/uploads/test.png | head -n 8 || true")
    run("curl -k -I -s https://miiooai.com/media/origin/test.txt | head -n 8 || true")


def main() -> None:
    write_extension_files()
    run("nginx -t")
    run("nginx -s reload")
    verify()


if __name__ == "__main__":
    main()
