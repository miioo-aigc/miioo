"""add user profile binding fields

Revision ID: c3d4e5f6a7b8
Revises: b1e2f3a4c5d6
Create Date: 2026-06-04 12:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b1e2f3a4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_phone_bound" not in columns:
        op.add_column(
            "users",
            sa.Column("is_phone_bound", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
        op.alter_column("users", "is_phone_bound", server_default=None)
    if "wechat_openid" not in columns:
        op.add_column("users", sa.Column("wechat_openid", sa.String(length=100), nullable=True))
        op.create_index(
            "ix_users_wechat_openid",
            "users",
            ["wechat_openid"],
            unique=True,
            postgresql_where=sa.text("wechat_openid IS NOT NULL"),
        )
    if "wechat_nickname" not in columns:
        op.add_column("users", sa.Column("wechat_nickname", sa.String(length=50), nullable=True))
    if "wechat_avatar_url" not in columns:
        op.add_column("users", sa.Column("wechat_avatar_url", sa.String(length=500), nullable=True))
    if "wechat_bound_at" not in columns:
        op.add_column("users", sa.Column("wechat_bound_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_wechat_openid" in indexes:
        op.drop_index("ix_users_wechat_openid", table_name="users")
    if "wechat_bound_at" in columns:
        op.drop_column("users", "wechat_bound_at")
    if "wechat_avatar_url" in columns:
        op.drop_column("users", "wechat_avatar_url")
    if "wechat_nickname" in columns:
        op.drop_column("users", "wechat_nickname")
    if "wechat_openid" in columns:
        op.drop_column("users", "wechat_openid")
    if "is_phone_bound" in columns:
        op.drop_column("users", "is_phone_bound")
