"""add backend hot path indexes

Revision ID: f4b6c8d0e1a2
Revises: c3d4e5f6a7b8, e2f3a4b5c6d7
Create Date: 2026-06-14 13:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4b6c8d0e1a2"
down_revision: Union[str, Sequence[str], None] = ("c3d4e5f6a7b8", "e2f3a4b5c6d7")
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

    if "assets" in tables:
        asset_index_defs = _load_index_defs(bind, "assets")
        if not _has_equivalent_index(
            asset_index_defs,
            index_name="ix_assets_user_deleted_created_id_desc",
            definition_fragment="using btree (user_id, is_deleted, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_assets_user_deleted_created_id_desc",
                "assets",
                ["user_id", "is_deleted", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )
        if not _has_equivalent_index(
            asset_index_defs,
            index_name="ix_assets_user_project_type_deleted_created_id_desc",
            definition_fragment=(
                "using btree (user_id, project_id, asset_type, is_deleted, created_at desc, id desc)"
            ),
        ):
            op.create_index(
                "ix_assets_user_project_type_deleted_created_id_desc",
                "assets",
                [
                    "user_id",
                    "project_id",
                    "asset_type",
                    "is_deleted",
                    sa.text("created_at DESC"),
                    sa.text("id DESC"),
                ],
                unique=False,
            )

    if "storyboards" in tables:
        storyboard_index_defs = _load_index_defs(bind, "storyboards")
        if not _has_equivalent_index(
            storyboard_index_defs,
            index_name="ix_storyboards_project_sort_shot_created",
            definition_fragment="using btree (project_id, sort_order, shot_number, created_at)",
        ):
            op.create_index(
                "ix_storyboards_project_sort_shot_created",
                "storyboards",
                ["project_id", "sort_order", "shot_number", "created_at"],
                unique=False,
            )
        if not _has_equivalent_index(
            storyboard_index_defs,
            index_name="ix_storyboards_project_episode_sort_shot_created",
            definition_fragment="using btree (project_id, episode_id, sort_order, shot_number, created_at)",
        ):
            op.create_index(
                "ix_storyboards_project_episode_sort_shot_created",
                "storyboards",
                ["project_id", "episode_id", "sort_order", "shot_number", "created_at"],
                unique=False,
            )

    if "projects" in tables:
        project_index_defs = _load_index_defs(bind, "projects")
        if not _has_equivalent_index(
            project_index_defs,
            index_name="ix_projects_user_updated_id_desc",
            definition_fragment="using btree (user_id, updated_at desc, id desc)",
        ):
            op.create_index(
                "ix_projects_user_updated_id_desc",
                "projects",
                ["user_id", sa.text("updated_at DESC"), sa.text("id DESC")],
                unique=False,
            )

    if "audio_clips" in tables:
        audio_index_defs = _load_index_defs(bind, "audio_clips")
        if not _has_equivalent_index(
            audio_index_defs,
            index_name="ix_audio_clips_user_project_audio_url",
            definition_fragment="using btree (user_id, project_id, audio_url)",
        ):
            op.create_index(
                "ix_audio_clips_user_project_audio_url",
                "audio_clips",
                ["user_id", "project_id", "audio_url"],
                unique=False,
            )

    if "video_clips" in tables:
        video_index_defs = _load_index_defs(bind, "video_clips")
        if not _has_equivalent_index(
            video_index_defs,
            index_name="ix_video_clips_user_project_video_url",
            definition_fragment="using btree (user_id, project_id, video_url)",
        ):
            op.create_index(
                "ix_video_clips_user_project_video_url",
                "video_clips",
                ["user_id", "project_id", "video_url"],
                unique=False,
            )

    if "gen_tasks" in tables:
        task_index_defs = _load_index_defs(bind, "gen_tasks")
        if not _has_equivalent_index(
            task_index_defs,
            index_name="ix_gen_tasks_user_created_id_desc",
            definition_fragment="using btree (user_id, created_at desc, id desc)",
        ):
            op.create_index(
                "ix_gen_tasks_user_created_id_desc",
                "gen_tasks",
                ["user_id", sa.text("created_at DESC"), sa.text("id DESC")],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "gen_tasks" in tables:
        _drop_index_if_exists(bind, "gen_tasks", "ix_gen_tasks_user_created_id_desc")
    if "video_clips" in tables:
        _drop_index_if_exists(bind, "video_clips", "ix_video_clips_user_project_video_url")
    if "audio_clips" in tables:
        _drop_index_if_exists(bind, "audio_clips", "ix_audio_clips_user_project_audio_url")
    if "projects" in tables:
        _drop_index_if_exists(bind, "projects", "ix_projects_user_updated_id_desc")
    if "storyboards" in tables:
        _drop_index_if_exists(bind, "storyboards", "ix_storyboards_project_episode_sort_shot_created")
        _drop_index_if_exists(bind, "storyboards", "ix_storyboards_project_sort_shot_created")
    if "assets" in tables:
        _drop_index_if_exists(bind, "assets", "ix_assets_user_project_type_deleted_created_id_desc")
        _drop_index_if_exists(bind, "assets", "ix_assets_user_deleted_created_id_desc")
