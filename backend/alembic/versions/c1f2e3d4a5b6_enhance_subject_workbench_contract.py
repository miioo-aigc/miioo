"""enhance subject workbench contract

Revision ID: c1f2e3d4a5b6
Revises: x7a8b9c0d123
Create Date: 2026-05-14 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1f2e3d4a5b6"
down_revision: Union[str, None] = "x7a8b9c0d123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subjects", sa.Column("reference_image_url", sa.String(length=500), nullable=True))
    op.add_column("subjects", sa.Column("reference_asset_id", sa.UUID(), nullable=True))
    op.add_column("subjects", sa.Column("gen_config", sa.JSON(), nullable=True))
    op.create_foreign_key(
        "fk_subjects_reference_asset",
        "subjects",
        "assets",
        ["reference_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("subject_images", sa.Column("asset_id", sa.UUID(), nullable=True))
    op.add_column("subject_images", sa.Column("generation_mode", sa.String(length=20), nullable=True))
    op.create_foreign_key(
        "fk_subject_images_asset",
        "subject_images",
        "assets",
        ["asset_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_subject_images_asset", "subject_images", type_="foreignkey")
    op.drop_column("subject_images", "generation_mode")
    op.drop_column("subject_images", "asset_id")

    op.drop_constraint("fk_subjects_reference_asset", "subjects", type_="foreignkey")
    op.drop_column("subjects", "gen_config")
    op.drop_column("subjects", "reference_asset_id")
    op.drop_column("subjects", "reference_image_url")
