"""add storyboards and gen_tasks tables

Revision ID: c6a4b7d8e925
Revises: b5f3d9e2a714
Create Date: 2026-05-11 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6a4b7d8e925'
down_revision: Union[str, None] = 'b5f3d9e2a714'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('storyboards',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('episode_id', sa.UUID(), nullable=True),
        sa.Column('shot_number', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('shot_type', sa.String(length=20), nullable=True),
        sa.Column('camera', sa.String(length=20), nullable=True),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('image_prompt', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('character_ids', sa.JSON(), nullable=True),
        sa.Column('scene_id', sa.UUID(), nullable=True),
        sa.Column('prop_ids', sa.JSON(), nullable=True),
        sa.Column('reference_image_urls', sa.JSON(), nullable=True),
        sa.Column('gen_params', sa.JSON(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['scene_id'], ['subjects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_storyboards_project_id'), 'storyboards', ['project_id'], unique=False)
    op.create_index(op.f('ix_storyboards_episode_id'), 'storyboards', ['episode_id'], unique=False)

    op.create_table('gen_tasks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('task_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('total_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('success_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fail_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('model', sa.String(length=50), nullable=True),
        sa.Column('size', sa.String(length=20), nullable=True),
        sa.Column('params', sa.JSON(), nullable=True),
        sa.Column('results', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_gen_tasks_user_id'), 'gen_tasks', ['user_id'], unique=False)
    op.create_index(op.f('ix_gen_tasks_project_id'), 'gen_tasks', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_gen_tasks_project_id'), table_name='gen_tasks')
    op.drop_index(op.f('ix_gen_tasks_user_id'), table_name='gen_tasks')
    op.drop_table('gen_tasks')
    op.drop_index(op.f('ix_storyboards_episode_id'), table_name='storyboards')
    op.drop_index(op.f('ix_storyboards_project_id'), table_name='storyboards')
    op.drop_table('storyboards')
