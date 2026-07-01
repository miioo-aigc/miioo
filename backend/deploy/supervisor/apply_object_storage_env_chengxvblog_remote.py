#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

ENV_PATH = Path("/www/wwwroot/chengxvblog.top/backend/.env")


def getenv(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    if value is None:
        return default
    value = value.strip()
    return value if value else default


def backup_file(path: Path, timestamp: str) -> None:
    backup_path = path.with_name(f"{path.name}.bak.object_storage_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backed_up={backup_path}")


def update_env_file() -> None:
    defaults = {
        "MEDIA_STORAGE_MODE": getenv("MEDIA_STORAGE_MODE", "hybrid"),
        "MEDIA_OBJECT_STORAGE_PROVIDER": getenv("MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos"),
        "MEDIA_OBJECT_STORAGE_REGION": getenv("MEDIA_OBJECT_STORAGE_REGION", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_ID": getenv("MEDIA_OBJECT_STORAGE_SECRET_ID", ""),
        "MEDIA_OBJECT_STORAGE_SECRET_KEY": getenv("MEDIA_OBJECT_STORAGE_SECRET_KEY", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_RAW": getenv("MEDIA_OBJECT_STORAGE_BUCKET_RAW", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW": getenv("MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED": getenv("MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_HLS": getenv("MEDIA_OBJECT_STORAGE_BUCKET_HLS", ""),
        "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD": getenv("MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD", ""),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW": getenv("MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW", "raw"),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW": getenv("MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW", "preview"),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED": getenv("MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED", "derived"),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS": getenv("MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS", "hls"),
        "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD": getenv(
            "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD",
            "private-download",
        ),
    }

    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    seen: set[str] = set()
    new_lines: list[str] = []
    for line in lines:
        if "=" not in line or line.lstrip().startswith("#"):
            new_lines.append(line)
            continue
        key, _ = line.split("=", 1)
        key = key.strip()
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


def run_shell(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file(ENV_PATH, timestamp)
    update_env_file()
    run_shell("supervisorctl restart chengxvblog-web chengxvblog-worker")
    run_shell("supervisorctl status chengxvblog-web chengxvblog-worker")


if __name__ == "__main__":
    main()
