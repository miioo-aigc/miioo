#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path


SUPPORTED_TABLES = {
    "api_config_banners",
    "api_config_card_visibility",
    "api_providers",
    "community_qr_configs",
    "model_configs",
}

STAGING_PREFIX = "_staging_"

INSERT_RE = re.compile(
    r"^(INSERT INTO public\.)"
    r"(?P<table>[a-zA-Z0-9_]+)"
    r"(\s*\()"
)


def build_merge_block(table: str) -> str:
    staging = f"{STAGING_PREFIX}{table}"

    if table == "api_config_banners":
        return f"""
UPDATE public.api_config_banners AS target
SET
    image_url = source.image_url,
    is_enabled = source.is_enabled,
    created_by = source.created_by,
    updated_by = source.updated_by,
    created_at = source.created_at,
    updated_at = source.updated_at
FROM {staging} AS source
WHERE target.id = source.id;

INSERT INTO public.api_config_banners (id, image_url, is_enabled, created_by, updated_by, created_at, updated_at)
SELECT source.id, source.image_url, source.is_enabled, source.created_by, source.updated_by, source.created_at, source.updated_at
FROM {staging} AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public.api_config_banners AS target
    WHERE target.id = source.id
);
""".strip()

    if table == "api_config_card_visibility":
        return f"""
UPDATE public.api_config_card_visibility AS target
SET
    is_visible = source.is_visible,
    created_by = source.created_by,
    updated_by = source.updated_by,
    created_at = source.created_at,
    updated_at = source.updated_at
FROM {staging} AS source
WHERE target.card_key = source.card_key;

INSERT INTO public.api_config_card_visibility (id, card_key, is_visible, created_by, updated_by, created_at, updated_at)
SELECT source.id, source.card_key, source.is_visible, source.created_by, source.updated_by, source.created_at, source.updated_at
FROM {staging} AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public.api_config_card_visibility AS target
    WHERE target.card_key = source.card_key
);
""".strip()

    if table == "api_providers":
        return f"""
UPDATE public.api_providers AS target
SET
    user_id = source.user_id,
    name = source.name,
    provider_type = source.provider_type,
    base_url = source.base_url,
    api_key_encrypted = source.api_key_encrypted,
    is_enabled = source.is_enabled,
    is_connected = source.is_connected,
    last_tested_at = source.last_tested_at,
    created_at = source.created_at,
    updated_at = source.updated_at,
    default_image_watermark = source.default_image_watermark,
    default_video_watermark = source.default_video_watermark,
    secondary_base_url = source.secondary_base_url,
    secondary_api_key_encrypted = source.secondary_api_key_encrypted,
    credential_mode = source.credential_mode
FROM {staging} AS source
WHERE target.id = source.id;

INSERT INTO public.api_providers (
    id, user_id, name, provider_type, base_url, api_key_encrypted, is_enabled, is_connected,
    last_tested_at, created_at, updated_at, default_image_watermark, default_video_watermark,
    secondary_base_url, secondary_api_key_encrypted, credential_mode
)
SELECT
    source.id, source.user_id, source.name, source.provider_type, source.base_url, source.api_key_encrypted,
    source.is_enabled, source.is_connected, source.last_tested_at, source.created_at, source.updated_at,
    source.default_image_watermark, source.default_video_watermark, source.secondary_base_url,
    source.secondary_api_key_encrypted, source.credential_mode
FROM {staging} AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public.api_providers AS target
    WHERE target.id = source.id
);
""".strip()

    if table == "community_qr_configs":
        return f"""
UPDATE public.community_qr_configs AS target
SET
    image_url = source.image_url,
    is_enabled = source.is_enabled,
    created_by = source.created_by,
    updated_by = source.updated_by,
    created_at = source.created_at,
    updated_at = source.updated_at
FROM {staging} AS source
WHERE target.id = source.id;

INSERT INTO public.community_qr_configs (id, image_url, is_enabled, created_by, updated_by, created_at, updated_at)
SELECT source.id, source.image_url, source.is_enabled, source.created_by, source.updated_by, source.created_at, source.updated_at
FROM {staging} AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public.community_qr_configs AS target
    WHERE target.id = source.id
);
""".strip()

    if table == "model_configs":
        return f"""
UPDATE public.model_configs AS target
SET
    provider_id = source.provider_id,
    user_id = source.user_id,
    name = source.name,
    model_id = source.model_id,
    category = source.category,
    description = source.description,
    is_enabled = source.is_enabled,
    is_default = source.is_default,
    created_at = source.created_at
FROM {staging} AS source
WHERE target.id = source.id;

INSERT INTO public.model_configs (
    id, provider_id, user_id, name, model_id, category, description, is_enabled, is_default, created_at
)
SELECT
    source.id, source.provider_id, source.user_id, source.name, source.model_id, source.category,
    source.description, source.is_enabled, source.is_default, source.created_at
FROM {staging} AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM public.model_configs AS target
    WHERE target.id = source.id
);
""".strip()

    raise ValueError(f"Unsupported table: {table}")


def transform_sql(input_text: str) -> str:
    seen_tables: list[str] = []
    output_lines: list[str] = []

    for line in input_text.splitlines():
        match = INSERT_RE.match(line)
        if match:
            table = match.group("table")
            if table not in SUPPORTED_TABLES:
                raise ValueError(f"暂不支持转换该表: {table}")
            if table not in seen_tables:
                seen_tables.append(table)
            staging = f"{STAGING_PREFIX}{table}"
            line = line.replace(f"INSERT INTO public.{table}", f"INSERT INTO {staging}", 1)
        output_lines.append(line)

    prelude: list[str] = [
        "-- Auto-generated incremental merge SQL",
        "BEGIN;",
        "",
    ]

    for table in seen_tables:
        prelude.extend(
            [
                f"CREATE TEMP TABLE {STAGING_PREFIX}{table} (LIKE public.{table} INCLUDING DEFAULTS) ON COMMIT DROP;",
                "",
            ]
        )

    merge_sections: list[str] = ["", "-- Merge staged rows into target tables", ""]
    for table in seen_tables:
        merge_sections.append(f"-- Merge for {table}")
        merge_sections.append(build_merge_block(table))
        merge_sections.append("")

    merge_sections.append("COMMIT;")

    return "\n".join(prelude + output_lines + merge_sections).strip() + "\n"


def default_output_path(input_path: Path) -> Path:
    if input_path.suffix.lower() == ".sql":
        return input_path.with_name(f"{input_path.stem}_merge.sql")
    return input_path.with_name(f"{input_path.name}_merge.sql")


def main() -> None:
    parser = argparse.ArgumentParser(description="将 data-only 增量 SQL 转为可重复执行的 merge SQL")
    parser.add_argument("input_file", help="原始 data-only SQL 文件路径")
    parser.add_argument("-o", "--output", help="输出文件路径；默认在同目录生成 *_merge.sql")
    args = parser.parse_args()

    input_path = Path(args.input_file).expanduser().resolve()
    if not input_path.is_file():
        raise SystemExit(f"输入文件不存在: {input_path}")

    output_path = Path(args.output).expanduser().resolve() if args.output else default_output_path(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    transformed = transform_sql(input_path.read_text(encoding="utf-8"))
    output_path.write_text(transformed, encoding="utf-8")

    print(output_path)


if __name__ == "__main__":
    main()
