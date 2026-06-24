"""persist user display id

Revision ID: d6e7f8a9b0c1
Revises: cd4e5f6a7b89
Create Date: 2026-06-16 22:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, Sequence[str], None] = "cd4e5f6a7b89"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DISPLAY_ID_PREFIX = "miioo_"
DISPLAY_ID_DIGITS = 6
DISPLAY_ID_LENGTH = len(DISPLAY_ID_PREFIX) + DISPLAY_ID_DIGITS
DISPLAY_ID_REGEX = r"^miioo_[0-9]{6}$"


def _build_random_display_id() -> str:
    random_sql = f"SELECT floor(random() * {10 ** DISPLAY_ID_DIGITS})::int"
    return op.get_bind().execute(sa.text(random_sql)).scalar_one()


def _format_display_id(number: int) -> str:
    return f"{DISPLAY_ID_PREFIX}{number:0{DISPLAY_ID_DIGITS}d}"


def _is_valid_display_id(value: str | None) -> bool:
    if not value:
        return False
    return len(value) == DISPLAY_ID_LENGTH and value.startswith(DISPLAY_ID_PREFIX) and value[6:].isdigit()


def _ensure_unique_index(inspector: sa.Inspector, table_name: str, index_name: str, column_name: str) -> None:
    indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}
    if index_name not in indexes and index_name not in unique_constraints:
        op.create_index(index_name, table_name, [column_name], unique=True)


def _drop_index_if_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> None:
    indexes = {index["name"] for index in inspector.get_indexes(table_name)}
    unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints(table_name)}
    if index_name in indexes or index_name in unique_constraints:
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "display_id" not in columns:
        op.add_column("users", sa.Column("display_id", sa.String(length=20), nullable=True))

    users_table = sa.table(
        "users",
        sa.column("id", sa.UUID()),
        sa.column("display_id", sa.String(length=20)),
    )

    rows = bind.execute(sa.select(users_table.c.id, users_table.c.display_id)).mappings().all()
    taken_display_ids = {
        str(row["display_id"])
        for row in rows
        if _is_valid_display_id(row["display_id"])
    }

    for row in rows:
        current_display_id = row["display_id"]
        if _is_valid_display_id(current_display_id):
            continue

        candidate = None
        while candidate is None or candidate in taken_display_ids:
            candidate = _format_display_id(_build_random_display_id())

        taken_display_ids.add(candidate)
        bind.execute(
            users_table.update()
            .where(users_table.c.id == row["id"])
            .values(display_id=candidate)
        )

    op.alter_column("users", "display_id", existing_type=sa.String(length=20), nullable=False)
    inspector = sa.inspect(bind)
    _ensure_unique_index(inspector, "users", "ix_users_display_id", "display_id")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "display_id" not in columns:
        return

    _drop_index_if_exists(inspector, "users", "ix_users_display_id")
    op.drop_column("users", "display_id")
