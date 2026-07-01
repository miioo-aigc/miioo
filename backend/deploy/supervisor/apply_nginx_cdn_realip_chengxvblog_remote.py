#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path


NGINX_PATHS = [
    Path("/www/server/panel/vhost/nginx/extension/chengxvblog.top/backend_proxy.conf"),
    Path("/www/server/panel/vhost/nginx/extension/www.chengxvblog.top/backend_proxy.conf"),
]

REAL_IP_BLOCK = """# CDN real IP compatibility start
# Temporary trust-all real_ip mode for CDN test environment.
# Replace with official EdgeOne source CIDRs when the upstream list is available.
set_real_ip_from 0.0.0.0/0;
set_real_ip_from ::/0;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
# CDN real IP compatibility end

"""


def backup_file(path: Path, timestamp: str) -> None:
    backup_path = path.with_name(f"{path.name}.bak.cdn_realip_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def upsert_real_ip_block(content: str) -> str:
    start_marker = "# CDN real IP compatibility start\n"
    end_marker = "# CDN real IP compatibility end\n\n"
    if start_marker in content and end_marker in content:
        start = content.index(start_marker)
        end = content.index(end_marker, start) + len(end_marker)
        return content[:start] + REAL_IP_BLOCK + content[end:]

    insert_marker = "location ^~ /uploads/ {"
    if insert_marker not in content:
        raise RuntimeError("未找到 /uploads/ 插入点，停止更新 Nginx 配置")
    return content.replace(insert_marker, REAL_IP_BLOCK + insert_marker, 1)


def upsert_forwarded_headers(content: str) -> str:
    host_header = "    proxy_set_header X-Forwarded-Host $host;\n"
    port_header = "    proxy_set_header X-Forwarded-Port $server_port;\n"
    if host_header in content and port_header in content:
        return content

    target = "    proxy_set_header X-Forwarded-Proto $scheme;\n"
    replacement = target + host_header + port_header
    return content.replace(target, replacement)


def update_nginx_files() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    for path in NGINX_PATHS:
        backup_file(path, timestamp)
        content = path.read_text(encoding="utf-8")
        content = upsert_real_ip_block(content)
        content = upsert_forwarded_headers(content)
        path.write_text(content, encoding="utf-8")
        print(f"updated={path}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    update_nginx_files()
    run("nginx -t")
    run("nginx -s reload")
    run("curl -k -I -s https://chengxvblog.top/api/providers | head -n 5")
    run("curl -k -I -s https://chengxvblog.top/openapi.json | head -n 5")


if __name__ == "__main__":
    main()
