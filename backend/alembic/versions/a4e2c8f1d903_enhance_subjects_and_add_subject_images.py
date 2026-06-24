"""enhance subjects and add subject_images

Revision ID: a4e2c8f1d903
Revises: 9aa1b9b76e05
Create Date: 2026-05-11 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4e2c8f1d903'
down_revision: Union[str, None] = '9aa1b9b76e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Subject 新增字段
    op.add_column('subjects', sa.Column('age', sa.String(length=30), nullable=True))
    op.add_column('subjects', sa.Column('gender', sa.String(length=20), nullable=True))
    op.add_column('subjects', sa.Column('background', sa.Text(), nullable=True))
    op.add_column('subjects', sa.Column('scene_type', sa.String(length=30), nullable=True))
    op.add_column('subjects', sa.Column('time_setting', sa.String(length=30), nullable=True))
    op.add_column('subjects', sa.Column('atmosphere', sa.Text(), nullable=True))
    op.add_column('subjects', sa.Column('importance', sa.String(length=20), nullable=True))
    op.add_column('subjects', sa.Column('owner_subject_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_subjects_owner', 'subjects', 'subjects', ['owner_subject_id'], ['id'], ondelete='SET NULL')

    # 新建 subject_images 表
    op.create_table('subject_images',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('prompt', sa.Text(), nullable=True),
        sa.Column('model', sa.String(length=50), nullable=True),
        sa.Column('size', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subject_images_subject_id'), 'subject_images', ['subject_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_subject_images_subject_id'), table_name='subject_images')
    op.drop_table('subject_images')
    op.drop_constraint('fk_subjects_owner', 'subjects', type_='foreignkey')
    op.drop_column('subjects', 'owner_subject_id')
    op.drop_column('subjects', 'importance')
    op.drop_column('subjects', 'atmosphere')
    op.drop_column('subjects', 'time_setting')
    op.drop_column('subjects', 'scene_type')
    op.drop_column('subjects', 'background')
    op.drop_column('subjects', 'gender')
    op.drop_column('subjects', 'age')
