"""add description and reference images to assets

Revision ID: d2e3f4a5b6c7
Revises: a1b2c3d4e5f7
Create Date: 2026-05-16 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assets", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("assets", sa.Column("reference_image_urls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("assets", "reference_image_urls")
    op.drop_column("assets", "description")
