"""add storyboard extended fields

Revision ID: x7a8b9c0d123
Revises: c6a4b7d8e925
Create Date: 2026-05-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'x7a8b9c0d123'
down_revision: Union[str, None] = 'c6a4b7d8e925'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('storyboards', sa.Column('camera_angle', sa.String(length=20), nullable=True))
    op.add_column('storyboards', sa.Column('composition', sa.String(length=20), nullable=True))
    op.add_column('storyboards', sa.Column('lighting', sa.Text(), nullable=True))
    op.add_column('storyboards', sa.Column('ambient_sound', sa.Text(), nullable=True))
    op.add_column('storyboards', sa.Column('voiceover', sa.Text(), nullable=True))
    op.add_column('storyboards', sa.Column('video_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('storyboards', 'video_url')
    op.drop_column('storyboards', 'voiceover')
    op.drop_column('storyboards', 'ambient_sound')
    op.drop_column('storyboards', 'lighting')
    op.drop_column('storyboards', 'composition')
    op.drop_column('storyboards', 'camera_angle')
