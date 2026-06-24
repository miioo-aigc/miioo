
#!/bin/bash
set -euo pipefail

source "$(dirname "$0")/_runtime_bootstrap.sh"

ensure_local_database_migrations
run_uvicorn_with_reload_policy "app.main:app" "0.0.0.0" "8000" "./start.sh"
