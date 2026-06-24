"""add query audit indexes

Revision ID: ab9f1c2d3e45
Revises: f4b6c8d0e1a2
Create Date: 2026-06-14 17:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ab9f1c2d3e45"
down_revision: Union[str, Sequence[str], None] = "f4b6c8d0e1a2"
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

    if "notifications" in tables:
        notification_index_defs = _load_index_defs(bind, "notifications")
        if not _has_equivalent_index(
            notification_index_defs,
            index_name="ix_notifications_user_created_id_desc",
            definition_fragment="using btree (user_id, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_notifications_user_created_id_desc",
                "notifications",
                ["user_id", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )
        if not _has_equivalent_index(
            notification_index_defs,
            index_name="ix_notifications_user_read_created_id_desc",
            definition_fragment="using btree (user_id, is_read, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_notifications_user_read_created_id_desc",
                "notifications",
                ["user_id", "is_read", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )

    if "gen_tasks" in tables:
        task_index_defs = _load_index_defs(bind, "gen_tasks")
        if not _has_equivalent_index(
            task_index_defs,
            index_name="ix_gen_tasks_user_status_created_id_desc",
            definition_fragment="using btree (user_id, status, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_gen_tasks_user_status_created_id_desc",
                "gen_tasks",
                ["user_id", "status", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )
        if not _has_equivalent_index(
            task_index_defs,
            index_name="ix_gen_tasks_user_project_created_id_desc",
            definition_fragment="using btree (user_id, project_id, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_gen_tasks_user_project_created_id_desc",
                "gen_tasks",
                ["user_id", "project_id", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )

    if "assets" in tables:
        asset_index_defs = _load_index_defs(bind, "assets")
        if not _has_equivalent_index(
            asset_index_defs,
            index_name="ix_assets_user_project_deleted_created_id_desc",
            definition_fragment="using btree (user_id, project_id, is_deleted, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_assets_user_project_deleted_created_id_desc",
                "assets",
                ["user_id", "project_id", "is_deleted", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )

    if "model_configs" in tables:
        model_config_index_defs = _load_index_defs(bind, "model_configs")
        if not _has_equivalent_index(
            model_config_index_defs,
            index_name="ix_model_configs_user_category_enabled_default",
            definition_fragment="using btree (user_id, category, is_enabled, is_default)",
        ):
            op.create_index(
                "ix_model_configs_user_category_enabled_default",
                "model_configs",
                ["user_id", "category", "is_enabled", "is_default"],
                unique=False,
            )

    if "subjects" in tables:
        subject_index_defs = _load_index_defs(bind, "subjects")
        if not _has_equivalent_index(
            subject_index_defs,
            index_name="ix_subjects_project_type_sort_created_id",
            definition_fragment="using btree (project_id, type, sort_order, created_at, id)",
        ):
            op.create_index(
                "ix_subjects_project_type_sort_created_id",
                "subjects",
                ["project_id", "type", "sort_order", "created_at", "id"],
                unique=False,
            )

    if "compositions" in tables:
        composition_index_defs = _load_index_defs(bind, "compositions")
        if not _has_equivalent_index(
            composition_index_defs,
            index_name="ix_compositions_project_user_status",
            definition_fragment="using btree (project_id, user_id, status)",
        ):
            op.create_index(
                "ix_compositions_project_user_status",
                "compositions",
                ["project_id", "user_id", "status"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "compositions" in tables:
        _drop_index_if_exists(bind, "compositions", "ix_compositions_project_user_status")
    if "subjects" in tables:
        _drop_index_if_exists(bind, "subjects", "ix_subjects_project_type_sort_created_id")
    if "model_configs" in tables:
        _drop_index_if_exists(bind, "model_configs", "ix_model_configs_user_category_enabled_default")
    if "assets" in tables:
        _drop_index_if_exists(bind, "assets", "ix_assets_user_project_deleted_created_id_desc")
    if "gen_tasks" in tables:
        _drop_index_if_exists(bind, "gen_tasks", "ix_gen_tasks_user_project_created_id_desc")
        _drop_index_if_exists(bind, "gen_tasks", "ix_gen_tasks_user_status_created_id_desc")
    if "notifications" in tables:
        _drop_index_if_exists(bind, "notifications", "ix_notifications_user_read_created_id_desc")
        _drop_index_if_exists(bind, "notifications", "ix_notifications_user_created_id_desc")
