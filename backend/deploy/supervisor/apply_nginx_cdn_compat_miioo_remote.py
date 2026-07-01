#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import time
from pathlib import Path


NGINX_PATH = Path("/www/server/panel/vhost/nginx/miiooaib.com.conf")

CDN_NOTE_BLOCK = """    # CDN compatibility note start
    # Production keeps real_ip whitelist unchanged here.
    # Add official Tencent EdgeOne/CDN origin-pull CIDRs via set_real_ip_from
    # only after the current list is verified from the console or official API.
    # CDN compatibility note end

"""

SSE_BLOCK = """    # SSE stream endpoints: disable buffering/cache for incremental chunks
    location ~ ^/api/(llm/chat/stream|projects/[^/]+/episodes/[^/]+/generate/stream|projects/[^/]+/script-workspace/chat/stream)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_buffering off;
        proxy_cache off;
        add_header X-Accel-Buffering no;
        proxy_connect_timeout 60s;
        proxy_read_timeout    1800s;
        proxy_send_timeout    1800s;
    }

"""


def backup_file(path: Path, timestamp: str) -> None:
    backup_path = path.with_name(f"{path.name}.bak.cdn_compat_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def upsert_note_block(content: str) -> str:
    start_marker = "    # CDN compatibility note start\n"
    end_marker = "    # CDN compatibility note end\n\n"
    if start_marker in content and end_marker in content:
        start = content.index(start_marker)
        end = content.index(end_marker, start) + len(end_marker)
        return content[:start] + CDN_NOTE_BLOCK + content[end:]

    insert_marker = "    # ─────────────────────────────────────────────────────────────────\n    # /uploads/"
    if insert_marker not in content:
        raise RuntimeError("未找到 CDN 注释插入点，停止修改 Nginx 配置")
    return content.replace(insert_marker, CDN_NOTE_BLOCK + insert_marker, 1)


def upsert_forwarded_headers(content: str) -> str:
    target = "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    replacement = (
        target
        + "        proxy_set_header X-Forwarded-Host $host;\n"
        + "        proxy_set_header X-Forwarded-Port $server_port;\n"
    )
    return content.replace(target, replacement)


def upsert_sse_block(content: str) -> str:
    pattern = (
        r"(?ms)^    # SSE stream endpoints: disable buffering/cache for incremental chunks\n"
        r"    location ~ \^/api/\(llm/chat/stream\|projects/\[\^/\]\+/episodes/\[\^/\]\+/generate/stream\|projects/\[\^/\]\+/script-workspace/chat/stream\)\$ \{\n"
        r".*?^    \}\n\n"
    )
    if re.search(pattern, content):
        return re.sub(pattern, SSE_BLOCK, content)

    insert_marker = "    # ─────────────────────────────────────────────────────────────────\n    # 全局反向代理：所有未匹配路径转发到 FastAPI（uvicorn :8000）"
    if insert_marker not in content:
        raise RuntimeError("未找到 SSE 插入点，停止修改 Nginx 配置")
    return content.replace(insert_marker, SSE_BLOCK + insert_marker, 1)


def update_nginx_file() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file(NGINX_PATH, timestamp)
    content = NGINX_PATH.read_text(encoding="utf-8")
    content = upsert_note_block(content)
    content = upsert_forwarded_headers(content)
    content = upsert_sse_block(content)
    NGINX_PATH.write_text(content, encoding="utf-8")
    print(f"updated={NGINX_PATH}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    update_nginx_file()
    run("nginx -t")
    run("nginx -s reload")
    run("supervisorctl status | grep -E '^miioo-web|^miioo-worker' || true")
    run("curl -k -I -s https://www.miiooai.com/docs | head -n 8")
    run("curl -k -I -s https://www.miiooai.com/openapi.json | head -n 8")
    run("curl -k -I -s https://www.miiooai.com/media/cdn/miioo-1435336579/raw/object-storage-health.txt | head -n 12 || true")


if __name__ == "__main__":
    main()
