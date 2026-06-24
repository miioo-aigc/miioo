"""add user account audit fields

Revision ID: e9f0a1b2c3d4
Revises: d6e7f8a9b0c1
Create Date: 2026-06-17 18:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e9f0a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}

    if "registered_phone" not in columns:
        op.add_column("users", sa.Column("registered_phone", sa.String(length=20), nullable=True))
    if "last_login_phone" not in columns:
        op.add_column("users", sa.Column("last_login_phone", sa.String(length=20), nullable=True))
    if "last_login_at" not in columns:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}

    if "last_login_at" in columns:
        op.drop_column("users", "last_login_at")
    if "last_login_phone" in columns:
        op.drop_column("users", "last_login_phone")
    if "registered_phone" in columns:
        op.drop_column("users", "registered_phone")
