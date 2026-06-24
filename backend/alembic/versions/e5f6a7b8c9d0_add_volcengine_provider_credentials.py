"""add volcengine provider credentials

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "api_providers" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("api_providers")}

    if "secondary_base_url" not in columns:
        op.add_column(
            "api_providers",
            sa.Column("secondary_base_url", sa.String(length=500), nullable=True),
        )

    if "secondary_api_key_encrypted" not in columns:
        op.add_column(
            "api_providers",
            sa.Column("secondary_api_key_encrypted", sa.Text(), nullable=True),
        )

    if "credential_mode" not in columns:
        op.add_column(
            "api_providers",
            sa.Column("credential_mode", sa.String(length=50), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "api_providers" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("api_providers")}

    if "credential_mode" in columns:
        op.drop_column("api_providers", "credential_mode")
    if "secondary_api_key_encrypted" in columns:
        op.drop_column("api_providers", "secondary_api_key_encrypted")
    if "secondary_base_url" in columns:
        op.drop_column("api_providers", "secondary_base_url")
