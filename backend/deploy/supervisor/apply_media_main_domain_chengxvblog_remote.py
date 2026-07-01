#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import time
from pathlib import Path


ENV_PATH = Path("/www/wwwroot/chengxvblog.top/backend/.env")
NGINX_PATHS = [
    Path("/www/server/panel/vhost/nginx/extension/chengxvblog.top/backend_proxy.conf"),
    Path("/www/server/panel/vhost/nginx/extension/www.chengxvblog.top/backend_proxy.conf"),
]

MEDIA_PUBLIC_BASE_URL = "https://www.chengxvblog.top/media/origin"
MEDIA_CDN_BASE_URL = "https://www.chengxvblog.top/media/cdn"
COS_HOST = "miioob-1302811912.cos.ap-beijing.myqcloud.com"
COS_UPSTREAM = f"https://{COS_HOST}"

MEDIA_BLOCK = f"""# MEDIA main-domain routing start
resolver 1.1.1.1 8.8.8.8 ipv6=off valid=300s;
resolver_timeout 10s;
set $media_origin_upstream "{COS_UPSTREAM}";
set $media_origin_host "{COS_HOST}";
set $media_cdn_upstream "{COS_UPSTREAM}";
set $media_cdn_host "{COS_HOST}";

location ~ ^/media/origin/[^/]+/(?<media_origin_path>.*)$ {{
    proxy_pass $media_origin_upstream/$media_origin_path$is_args$args;
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_ssl_name $media_origin_host;
    proxy_set_header Host $media_origin_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_buffering off;
    add_header X-Media-Proxy "origin" always;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}}

location ~ ^/media/cdn/[^/]+/(?<media_cdn_path>.*)$ {{
    proxy_pass $media_cdn_upstream/$media_cdn_path$is_args$args;
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_ssl_name $media_cdn_host;
    proxy_set_header Host $media_cdn_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    add_header X-Media-Proxy "cdn" always;
    proxy_connect_timeout 60s;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}}
# MEDIA main-domain routing end

"""


def backup_file(path: Path, timestamp: str, label: str) -> None:
    backup_path = path.with_name(f"{path.name}.bak.{label}_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def update_env_file() -> None:
    defaults = {
        "MEDIA_STORAGE_MODE": "hybrid",
        "MEDIA_PUBLIC_BASE_URL": MEDIA_PUBLIC_BASE_URL,
        "MEDIA_CDN_BASE_URL": MEDIA_CDN_BASE_URL,
    }
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    new_lines: list[str] = []
    key_pattern = re.compile(r"^([A-Z0-9_]+)=")
    for line in lines:
        match = key_pattern.match(line)
        if not match:
            new_lines.append(line)
            continue
        key = match.group(1)
        if key in defaults:
            new_lines.append(f"{key}={defaults[key]}")
            seen.add(key)
        else:
            new_lines.append(line)
    for key, value in defaults.items():
        if key not in seen:
            new_lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(new_lines).rstrip() + "\n", encoding="utf-8")
    print(f"updated_env={ENV_PATH}")


def update_nginx_file(path: Path) -> None:
    content = path.read_text(encoding="utf-8")
    start = "# MEDIA main-domain routing start\n"
    end = "# MEDIA main-domain routing end\n\n"
    if start in content and end in content:
        s = content.index(start)
        e = content.index(end, s) + len(end)
        content = content[:s] + MEDIA_BLOCK + content[e:]
    else:
        marker = "\nlocation = /docs {"
        if marker not in content:
            raise RuntimeError(f"未找到媒体代理插入点: {path}")
        content = content.replace(marker, "\n" + MEDIA_BLOCK + "location = /docs {", 1)
    path.write_text(content, encoding="utf-8")
    print(f"updated_nginx={path}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file(ENV_PATH, timestamp, "media_domain")
    update_env_file()
    for path in NGINX_PATHS:
        backup_file(path, timestamp, "media_domain")
        update_nginx_file(path)

    run("nginx -t")
    run("nginx -s reload")
    run("supervisorctl restart chengxvblog-web chengxvblog-worker")
    run("supervisorctl status chengxvblog-web chengxvblog-worker")
    run("curl -k -I -s https://www.chengxvblog.top/media/origin/miioob-1302811912/raw/object-storage-health.txt | head -n 8")
    run("curl -k -I -s https://www.chengxvblog.top/media/cdn/miioob-1302811912/raw/object-storage-health.txt | head -n 8")


if __name__ == "__main__":
    main()
