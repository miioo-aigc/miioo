#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path


EXTENSION_DIR = Path("/www/server/panel/vhost/nginx/extension/miioo.com")
EXTENSION_PATH = EXTENSION_DIR / "apex_media_fallback.conf"

APEX_MEDIA_FALLBACK_CONTENT = """# Apex miiooai.com media fallback start
location ^~ /uploads/ {
    return 302 https://www.miiooai.com$request_uri;
}

location ^~ /media/ {
    return 302 https://www.miiooai.com$request_uri;
}
# Apex miiooai.com media fallback end
"""


def backup_file(path: Path, timestamp: str) -> None:
    if not path.exists():
        return
    backup_path = path.with_name(f"{path.name}.bak.apex_media_fallback_{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"backup={backup_path}")


def run(command: str) -> None:
    print(f"run={command}")
    subprocess.run(command, shell=True, check=True)


def main() -> None:
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    EXTENSION_DIR.mkdir(parents=True, exist_ok=True)
    backup_file(EXTENSION_PATH, timestamp)
    EXTENSION_PATH.write_text(APEX_MEDIA_FALLBACK_CONTENT, encoding="utf-8")
    print(f"updated={EXTENSION_PATH}")

    run("nginx -t")
    run("nginx -s reload")
    run("curl -k -I -s https://miiooai.com/uploads/creation/global/uploads/1e0b7ea5dc1e4a9f937474389982c2c2.png | head -n 12")
    run("curl -k -I -s https://miiooai.com/media/origin/miioo-1435336579/raw/health-check.txt | head -n 12 || true")


if __name__ == "__main__":
    main()
