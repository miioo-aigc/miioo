#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
from pathlib import Path


ENV_PATH = Path("/www/wwwroot/miiooaib.com/backend/.env")
SUPERVISOR_PATH = Path("/etc/supervisord.d/miioo-backend.ini")
NGINX_PATH = Path("/www/server/panel/vhost/nginx/miiooaib.com.conf")

PLACEHOLDER_ORIGIN_UPSTREAM = "https://origin-placeholder.invalid"
PLACEHOLDER_ORIGIN_HOST = "origin-placeholder.invalid"
PLACEHOLDER_CDN_UPSTREAM = "https://cdn-placeholder.invalid"
PLACEHOLDER_CDN_HOST = "cdn-placeholder.invalid"


def getenv(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    if value is None:
        return default
    value = value.strip()
    return value if value else default


def backup_file(path: Path, timestamp: str) -> None:
    backup_path = path.with_name(f"{path.name}.bak.media_bplus_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backed_up={backup_path}")


def update_env_file() -> None:
    defaults = {
        "MEDIA_STORAGE_MODE": getenv("MEDIA_STORAGE_MODE", "local"),
        "MEDIA_PUBLIC_BASE_URL": getenv(
            "MEDIA_PUBLIC_BASE_URL", "https://www.miiooai.com/media/origin"
        ),
        "MEDIA_CDN_BASE_URL": getenv(
            "MEDIA_CDN_BASE_URL", "https://www.miiooai.com/media/cdn"
        ),
        "MEDIA_OBJECT_STORAGE_PROVIDER": getenv(
            "MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos"
        ),
        "MEDIA_OBJECT_STORAGE_REGION": getenv("MEDIA_OBJECT_STORAGE_REGION", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_ID": getenv("MEDIA_OBJECT_STORAGE_SECRET_ID", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_KEY": getenv("MEDIA_OBJECT_STORAGE_SECRET_KEY", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_RAW": getenv("MEDIA_OBJECT_STORAGE_BUCKET_RAW", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", ""
        ),
        "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", ""
        ),
        "MEDIA_OBJECT_STORAGE_BUCKET_HLS": getenv("MEDIA_OBJECT_STORAGE_BUCKET_HLS", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD", ""
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW", "raw"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW", "preview"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED", "derived"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS", "hls"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD", "private-download"
        ),
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


def parse_environment_line(line: str) -> dict[str, str]:
    env_text = line.split("environment=", 1)[1].strip()
    pairs = re.findall(r'([A-Z0-9_]+)="([^"]*)"', env_text)
    return {key: value for key, value in pairs}


def dump_environment_line(values: dict[str, str]) -> str:
    ordered = ",".join(f'{key}="{value}"' for key, value in values.items())
    return f"environment={ordered}"


def update_supervisor_file() -> None:
    extra_env = {
        "MEDIA_STORAGE_MODE": getenv("MEDIA_STORAGE_MODE", "local"),
        "MEDIA_PUBLIC_BASE_URL": getenv(
            "MEDIA_PUBLIC_BASE_URL", "https://www.miiooai.com/media/origin"
        ),
        "MEDIA_CDN_BASE_URL": getenv(
            "MEDIA_CDN_BASE_URL", "https://www.miiooai.com/media/cdn"
        ),
        "MEDIA_OBJECT_STORAGE_PROVIDER": getenv(
            "MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos"
        ),
        "MEDIA_OBJECT_STORAGE_REGION": getenv("MEDIA_OBJECT_STORAGE_REGION", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_ID": getenv("MEDIA_OBJECT_STORAGE_SECRET_ID", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_KEY": getenv("MEDIA_OBJECT_STORAGE_SECRET_KEY", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_RAW": getenv("MEDIA_OBJECT_STORAGE_BUCKET_RAW", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", ""
        ),
        "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", ""
        ),
        "MEDIA_OBJECT_STORAGE_BUCKET_HLS": getenv("MEDIA_OBJECT_STORAGE_BUCKET_HLS", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD": getenv(
            "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD", ""
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW", "raw"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW", "preview"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED", "derived"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS", "hls"
        ),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD", "private-download"
        ),
    }

    lines = SUPERVISOR_PATH.read_text(encoding="utf-8").splitlines()
    new_lines: list[str] = []
    for line in lines:
        if line.startswith("environment="):
            env_values = parse_environment_line(line)
            env_values.update(extra_env)
            line = dump_environment_line(env_values)
        new_lines.append(line)
    SUPERVISOR_PATH.write_text(
        "\n".join(new_lines).rstrip() + "\n",
        encoding="utf-8",
    )
    print(f"updated_supervisor={SUPERVISOR_PATH}")


def build_media_block() -> str:
    media_origin_upstream = getenv(
        "MEDIA_ORIGIN_UPSTREAM", PLACEHOLDER_ORIGIN_UPSTREAM
    )
    media_origin_host = getenv("MEDIA_ORIGIN_HOST", PLACEHOLDER_ORIGIN_HOST)
    media_cdn_upstream = getenv("MEDIA_CDN_UPSTREAM", PLACEHOLDER_CDN_UPSTREAM)
    media_cdn_host = getenv("MEDIA_CDN_HOST", PLACEHOLDER_CDN_HOST)
    return f"""
    # ─────────────────────────────────────────────────────────────────
    # MEDIA-BPLUS 首轮主域复用：
    # - 仅有 www.miiooai.com 一个后端域名时，统一复用主域路径承接对象存储
    # - /media/origin/<bucket>/<key> -> COS 源站或对象回源网关
    # - /media/cdn/<bucket>/<key>    -> CDN 入口；若 CDN 暂未启用，可先回到同一源站
    # ─────────────────────────────────────────────────────────────────
    set $media_origin_upstream "{media_origin_upstream}";
    set $media_origin_host "{media_origin_host}";
    set $media_cdn_upstream "{media_cdn_upstream}";
    set $media_cdn_host "{media_cdn_host}";

    location ~ ^/media/origin/[^/]+/(?<media_origin_path>.*)$ {{
        if ($media_origin_host = "{PLACEHOLDER_ORIGIN_HOST}") {{
            return 503;
        }}

        proxy_pass $media_origin_upstream/$media_origin_path$is_args$args;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_name $media_origin_host;
        proxy_set_header Host $media_origin_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        add_header X-Media-Proxy "origin" always;
        proxy_connect_timeout 60s;
        proxy_read_timeout    1800s;
        proxy_send_timeout    1800s;
    }}

    location ~ ^/media/cdn/[^/]+/(?<media_cdn_path>.*)$ {{
        if ($media_cdn_host = "{PLACEHOLDER_CDN_HOST}") {{
            return 503;
        }}

        proxy_pass $media_cdn_upstream/$media_cdn_path$is_args$args;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_name $media_cdn_host;
        proxy_set_header Host $media_cdn_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header X-Media-Proxy "cdn" always;
        proxy_connect_timeout 60s;
        proxy_read_timeout    1800s;
        proxy_send_timeout    1800s;
    }}
""".rstrip("\n")


def update_nginx_file() -> None:
    content = NGINX_PATH.read_text(encoding="utf-8")
    resolver_block = (
        "    resolver 1.1.1.1 8.8.8.8 ipv6=off valid=300s;\n"
        "    resolver_timeout 10s;\n"
    )
    content = re.sub(
        r"(?m)^(\s*alias\s+).*$",
        r"\1/www/wwwroot/miiooaib.com/backend/uploads/;",
        content,
        count=1,
    )
    if "resolver 1.1.1.1 8.8.8.8 ipv6=off valid=300s;" not in content:
        marker = (
            "    # ─────────────────────────────────────────────────────────────────\n"
            "    # MEDIA-BPLUS 首轮主域复用："
        )
        if marker not in content:
            raise RuntimeError("未找到 Nginx MEDIA-BPLUS 插入点，已停止修改")
        content = content.replace(marker, resolver_block + marker, 1)

    media_block = build_media_block()
    if "set $media_origin_upstream" in content:
        replacements = {
            "media_origin_upstream": getenv(
                "MEDIA_ORIGIN_UPSTREAM", PLACEHOLDER_ORIGIN_UPSTREAM
            ),
            "media_origin_host": getenv("MEDIA_ORIGIN_HOST", PLACEHOLDER_ORIGIN_HOST),
            "media_cdn_upstream": getenv(
                "MEDIA_CDN_UPSTREAM", PLACEHOLDER_CDN_UPSTREAM
            ),
            "media_cdn_host": getenv("MEDIA_CDN_HOST", PLACEHOLDER_CDN_HOST),
        }
        for key, value in replacements.items():
            content = re.sub(
                rf'(?m)^(\s*set \${key}\s+).*$',
                rf'\1"{value}";',
                content,
                count=1,
            )
        content = re.sub(
            r"(?m)^(\s*location\s+~\s+\^/media/origin/).*(\{\s*)$",
            r"\1[^/]+/(?<media_origin_path>.*)$ \2",
            content,
            count=1,
        )
        content = re.sub(
            r"(?m)^(\s*location\s+~\s+\^/media/cdn/).*(\{\s*)$",
            r"\1[^/]+/(?<media_cdn_path>.*)$ \2",
            content,
            count=1,
        )
        content = re.sub(
            r"(?m)^(\s*alias\s+).*$",
            r"\1/www/wwwroot/miiooaib.com/backend/uploads/;",
            content,
            count=1,
        )
    else:
        marker = "\n    # ─────────────────────────────────────────────────────────────────\n    # 全局反向代理"
        if marker not in content:
            raise RuntimeError("未找到 Nginx 全局反向代理插入点，已停止修改")
        content = content.replace(marker, "\n" + media_block + marker, 1)

    NGINX_PATH.write_text(content, encoding="utf-8")
    print(f"updated_nginx={NGINX_PATH}")


def run_shell(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file(ENV_PATH, timestamp)
    backup_file(SUPERVISOR_PATH, timestamp)
    backup_file(NGINX_PATH, timestamp)

    update_env_file()
    update_supervisor_file()
    update_nginx_file()

    run_shell("nginx -t")
    run_shell("nginx -s reload")
    run_shell("supervisorctl reread")
    run_shell("supervisorctl update")
    run_shell(
        r"""names=$(supervisorctl status | awk '/^miioo-web|^miioo-worker/ {print $1}' | paste -sd' ' -); """
        r"""if [ -n "$names" ]; then supervisorctl restart $names; fi"""
    )
    run_shell("supervisorctl status")
    run_shell("curl -I -s http://127.0.0.1:8000/docs | head -n 5")


if __name__ == "__main__":
    main()
