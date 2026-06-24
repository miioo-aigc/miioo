"""add provider watermark defaults

Revision ID: d4e5f6a7b8c9
Revises: c9d0e1f2a3b4
Create Date: 2026-05-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "api_providers" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("api_providers")}

    if "default_image_watermark" not in columns:
        op.add_column(
            "api_providers",
            sa.Column(
                "default_image_watermark",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.alter_column("api_providers", "default_image_watermark", server_default=None)

    if "default_video_watermark" not in columns:
        op.add_column(
            "api_providers",
            sa.Column(
                "default_video_watermark",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.alter_column("api_providers", "default_video_watermark", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "api_providers" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("api_providers")}

    if "default_video_watermark" in columns:
        op.drop_column("api_providers", "default_video_watermark")
    if "default_image_watermark" in columns:
        op.drop_column("api_providers", "default_image_watermark")
