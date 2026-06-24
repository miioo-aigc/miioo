"""add trgm search indexes for voice and audio search

Revision ID: cd4e5f6a7b89
Revises: bc3d4e5f6a78
Create Date: 2026-06-14 19:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cd4e5f6a7b89"
down_revision: Union[str, Sequence[str], None] = "bc3d4e5f6a78"
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

    if "voices" in tables:
        voice_index_defs = _load_index_defs(bind, "voices")
        voice_index_specs = [
            ("ix_voices_name_trgm", "using gin (name gin_trgm_ops)", "name"),
            ("ix_voices_style_trgm", "using gin (style gin_trgm_ops)", "style"),
            ("ix_voices_emotions_trgm", "using gin (emotions gin_trgm_ops)", "emotions"),
        ]
        for index_name, definition_fragment, column_name in voice_index_specs:
            if not _has_equivalent_index(
                voice_index_defs,
                index_name=index_name,
                definition_fragment=definition_fragment,
            ):
                op.create_index(
                    index_name,
                    "voices",
                    [column_name],
                    unique=False,
                    postgresql_using="gin",
                    postgresql_ops={column_name: "gin_trgm_ops"},
                )

    if "reference_audio_library_items" in tables:
        reference_index_defs = _load_index_defs(bind, "reference_audio_library_items")
        reference_index_specs = [
            ("ix_reference_audio_items_name_trgm", "using gin (name gin_trgm_ops)", "name"),
            (
                "ix_reference_audio_items_description_trgm",
                "using gin (description gin_trgm_ops)",
                "description",
            ),
            ("ix_reference_audio_items_emotion_trgm", "using gin (emotion gin_trgm_ops)", "emotion"),
        ]
        for index_name, definition_fragment, column_name in reference_index_specs:
            if not _has_equivalent_index(
                reference_index_defs,
                index_name=index_name,
                definition_fragment=definition_fragment,
            ):
                op.create_index(
                    index_name,
                    "reference_audio_library_items",
                    [column_name],
                    unique=False,
                    postgresql_using="gin",
                    postgresql_ops={column_name: "gin_trgm_ops"},
                )

    if "audio_clips" in tables:
        audio_clip_index_defs = _load_index_defs(bind, "audio_clips")
        if not _has_equivalent_index(
            audio_clip_index_defs,
            index_name="ix_audio_clips_text_trgm",
            definition_fragment="using gin (text gin_trgm_ops)",
        ):
            op.create_index(
                "ix_audio_clips_text_trgm",
                "audio_clips",
                ["text"],
                unique=False,
                postgresql_using="gin",
                postgresql_ops={"text": "gin_trgm_ops"},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "audio_clips" in tables:
        _drop_index_if_exists(bind, "audio_clips", "ix_audio_clips_text_trgm")
    if "reference_audio_library_items" in tables:
        _drop_index_if_exists(bind, "reference_audio_library_items", "ix_reference_audio_items_emotion_trgm")
        _drop_index_if_exists(bind, "reference_audio_library_items", "ix_reference_audio_items_description_trgm")
        _drop_index_if_exists(bind, "reference_audio_library_items", "ix_reference_audio_items_name_trgm")
    if "voices" in tables:
        _drop_index_if_exists(bind, "voices", "ix_voices_emotions_trgm")
        _drop_index_if_exists(bind, "voices", "ix_voices_style_trgm")
        _drop_index_if_exists(bind, "voices", "ix_voices_name_trgm")
