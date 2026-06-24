"""fix gen_tasks model length

Revision ID: 1b2c3d4e5f67
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1b2c3d4e5f67"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("gen_tasks", "model", existing_type=sa.String(length=50), type_=sa.String(length=200), nullable=True)


def downgrade() -> None:
    op.alter_column("gen_tasks", "model", existing_type=sa.String(length=200), type_=sa.String(length=50), nullable=True)
