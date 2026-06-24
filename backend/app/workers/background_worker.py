from __future__ import annotations

import asyncio
import socket
import uuid

from app.services.background_runtime import ensure_background_runtime_ready, run_background_worker


async def _main() -> None:
    await ensure_background_runtime_ready()
    worker_id = f"{socket.gethostname()}:{uuid.uuid4()}"
    await run_background_worker(worker_id=worker_id)


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
