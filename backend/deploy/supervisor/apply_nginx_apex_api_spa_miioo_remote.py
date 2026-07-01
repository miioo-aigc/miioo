#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path


EXTENSION_DIR = Path("/www/server/panel/vhost/nginx/extension/miioo.com")
EXTENSION_PATH = EXTENSION_DIR / "apex_api_spa.conf"

APEX_EXTENSION_CONTENT = """# Apex miiooai.com API + SPA compatibility start
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
    proxy_read_timeout    1800s;
    proxy_send_timeout    1800s;
}

location / {
    try_files $uri $uri/ /index.html;
}
# Apex miiooai.com API + SPA compatibility end
"""


def backup_file(path: Path, timestamp: str) -> None:
    if not path.exists():
        return
    backup_path = path.with_name(f"{path.name}.bak.apex_api_spa_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    EXTENSION_DIR.mkdir(parents=True, exist_ok=True)
    backup_file(EXTENSION_PATH, timestamp)
    EXTENSION_PATH.write_text(APEX_EXTENSION_CONTENT, encoding="utf-8")
    print(f"updated={EXTENSION_PATH}")

    run("nginx -t")
    run("nginx -s reload")
    run("curl -k -I -s https://miiooai.com/api/providers | head -n 8")
    run("curl -k -I -s https://miiooai.com/non-existent-spa-route-test | head -n 8")


if __name__ == "__main__":
    main()
