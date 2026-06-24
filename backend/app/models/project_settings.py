import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProjectSettings(Base):
    __tablename__ = "project_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    script_tone: Mapped[str] = mapped_column(String(50), default="neutral")
    dialogue_density: Mapped[str] = mapped_column(String(20), default="medium")
    shot_rhythm: Mapped[str] = mapped_column(String(20), default="medium")
    character_consistency: Mapped[bool] = mapped_column(Boolean, default=True)
    scene_consistency: Mapped[bool] = mapped_column(Boolean, default=True)
    output_format: Mapped[str] = mapped_column(String(50), default="standard")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
