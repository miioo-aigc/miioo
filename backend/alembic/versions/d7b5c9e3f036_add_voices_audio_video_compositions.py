"""add voices audio_clips video_clips compositions tables

Revision ID: d7b5c9e3f036
Revises: c6a4b7d8e925
Create Date: 2026-05-11 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7b5c9e3f036'
down_revision: Union[str, None] = 'c6a4b7d8e925'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # subjects 新增 voice_id
    op.add_column('subjects', sa.Column('voice_id', sa.String(length=100), nullable=True))

    # voices 表
    op.create_table('voices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('voice_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('gender', sa.String(length=10), nullable=True),
        sa.Column('age_group', sa.String(length=20), nullable=True),
        sa.Column('language', sa.String(length=20), nullable=True),
        sa.Column('style', sa.String(length=50), nullable=True),
        sa.Column('preview_url', sa.String(length=500), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False, server_default='onelinkai'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('voice_id')
    )

    # audio_clips 表
    op.create_table('audio_clips',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('storyboard_id', sa.UUID(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('voice_id', sa.String(length=100), nullable=False),
        sa.Column('audio_url', sa.String(length=500), nullable=False),
        sa.Column('duration', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('emotion', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['storyboard_id'], ['storyboards.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audio_clips_user_id'), 'audio_clips', ['user_id'], unique=False)
    op.create_index(op.f('ix_audio_clips_project_id'), 'audio_clips', ['project_id'], unique=False)

    # video_clips 表
    op.create_table('video_clips',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('storyboard_id', sa.UUID(), nullable=True),
        sa.Column('video_url', sa.String(length=500), nullable=False),
        sa.Column('duration', sa.Float(), nullable=False),
        sa.Column('model', sa.String(length=50), nullable=True),
        sa.Column('prompt', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['storyboard_id'], ['storyboards.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_video_clips_user_id'), 'video_clips', ['user_id'], unique=False)
    op.create_index(op.f('ix_video_clips_project_id'), 'video_clips', ['project_id'], unique=False)

    # compositions 表
    op.create_table('compositions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('timeline', sa.JSON(), nullable=True),
        sa.Column('subtitle_style', sa.JSON(), nullable=True),
        sa.Column('resolution', sa.String(length=20), nullable=False, server_default='1080p'),
        sa.Column('aspect_ratio', sa.String(length=10), nullable=False, server_default='16:9'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('output_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_compositions_user_id'), 'compositions', ['user_id'], unique=False)
    op.create_index(op.f('ix_compositions_project_id'), 'compositions', ['project_id'], unique=False)

    # 预置音色数据
    op.execute("""
        INSERT INTO voices (id, voice_id, name, gender, age_group, language, style, provider) VALUES
        (gen_random_uuid(), 'zh-CN-XiaoxiaoNeural', '晓晓', '女', '青年', '中文', '温柔', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-YunxiNeural', '云希', '男', '青年', '中文', '阳光', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-YunjianNeural', '云健', '男', '中年', '中文', '沉稳', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-XiaoyiNeural', '晓伊', '女', '青年', '中文', '活泼', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-YunyangNeural', '云扬', '男', '青年', '中文', '新闻', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-XiaochenNeural', '晓辰', '女', '中年', '中文', '知性', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-XiaohanNeural', '晓涵', '女', '青年', '中文', '甜美', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-XiaomoNeural', '晓墨', '女', '青年', '中文', '文艺', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-XiaoshuangNeural', '晓双', '女', '少年', '中文', '童声', 'onelinkai'),
        (gen_random_uuid(), 'zh-CN-YunfengNeural', '云枫', '男', '中年', '中文', '磁性', 'onelinkai'),
        (gen_random_uuid(), 'en-US-JennyNeural', 'Jenny', '女', '青年', '英文', 'Friendly', 'onelinkai'),
        (gen_random_uuid(), 'en-US-GuyNeural', 'Guy', '男', '青年', '英文', 'Casual', 'onelinkai')
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_compositions_project_id'), table_name='compositions')
    op.drop_index(op.f('ix_compositions_user_id'), table_name='compositions')
    op.drop_table('compositions')
    op.drop_index(op.f('ix_video_clips_project_id'), table_name='video_clips')
    op.drop_index(op.f('ix_video_clips_user_id'), table_name='video_clips')
    op.drop_table('video_clips')
    op.drop_index(op.f('ix_audio_clips_project_id'), table_name='audio_clips')
    op.drop_index(op.f('ix_audio_clips_user_id'), table_name='audio_clips')
    op.drop_table('audio_clips')
    op.drop_table('voices')
    op.drop_column('subjects', 'voice_id')
