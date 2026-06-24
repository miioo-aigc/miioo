"""add trgm search indexes for assets and projects

Revision ID: bc3d4e5f6a78
Revises: ab9f1c2d3e45
Create Date: 2026-06-14 18:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "bc3d4e5f6a78"
down_revision: Union[str, Sequence[str], None] = "ab9f1c2d3e45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _load_index_defs(bind: sa.engine.Connection, table_name: str) -> dict[str, str]:
    rows = bind.execute(
        sa.text(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = :table_name
            """
        ),
        {"table_name": table_name},
    ).mappings()
    return {
        row["indexname"]: " ".join(str(row["indexdef"]).lower().split())
        for row in rows
    }


def _has_equivalent_index(
    index_defs: dict[str, str],
    *,
    index_name: str,
    definition_fragment: str,
) -> bool:
    if index_name in index_defs:
        return True
    normalized_fragment = " ".join(definition_fragment.lower().split())
    return any(normalized_fragment in index_def for index_def in index_defs.values())


def _drop_index_if_exists(bind: sa.engine.Connection, table_name: str, index_name: str) -> None:
    index_names = {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}
    if index_name in index_names:
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    if "assets" in tables:
        asset_index_defs = _load_index_defs(bind, "assets")
        if not _has_equivalent_index(
            asset_index_defs,
            index_name="ix_assets_name_trgm",
            definition_fragment="using gin (name gin_trgm_ops)",
        ):
            op.create_index(
                "ix_assets_name_trgm",
                "assets",
                ["name"],
                unique=False,
                postgresql_using="gin",
                postgresql_ops={"name": "gin_trgm_ops"},
            )
        if not _has_equivalent_index(
            asset_index_defs,
            index_name="ix_assets_prompt_trgm",
            definition_fragment="using gin (prompt gin_trgm_ops)",
        ):
            op.create_index(
                "ix_assets_prompt_trgm",
                "assets",
                ["prompt"],
                unique=False,
                postgresql_using="gin",
                postgresql_ops={"prompt": "gin_trgm_ops"},
            )

    if "projects" in tables:
        project_index_defs = _load_index_defs(bind, "projects")
        if not _has_equivalent_index(
            project_index_defs,
            index_name="ix_projects_name_trgm",
            definition_fragment="using gin (name gin_trgm_ops)",
        ):
            op.create_index(
                "ix_projects_name_trgm",
                "projects",
                ["name"],
                unique=False,
                postgresql_using="gin",
                postgresql_ops={"name": "gin_trgm_ops"},
            )
        if not _has_equivalent_index(
            project_index_defs,
            index_name="ix_projects_description_trgm",
            definition_fragment="using gin (description gin_trgm_ops)",
        ):
            op.create_index(
                "ix_projects_description_trgm",
                "projects",
                ["description"],
                unique=False,
                postgresql_using="gin",
                postgresql_ops={"description": "gin_trgm_ops"},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "projects" in tables:
        _drop_index_if_exists(bind, "projects", "ix_projects_description_trgm")
        _drop_index_if_exists(bind, "projects", "ix_projects_name_trgm")
    if "assets" in tables:
        _drop_index_if_exists(bind, "assets", "ix_assets_prompt_trgm")
        _drop_index_if_exists(bind, "assets", "ix_assets_name_trgm")
