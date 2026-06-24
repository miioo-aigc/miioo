"""add user_styles table

Revision ID: f9a7b2c3d456
Revises: e8c6d0f4a147
Create Date: 2026-05-12 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f9a7b2c3d456'
down_revision: Union[str, None] = 'e8c6d0f4a147'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('user_styles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('color', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_styles_user_id'), 'user_styles', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_styles_user_id'), table_name='user_styles')
    op.drop_table('user_styles')
