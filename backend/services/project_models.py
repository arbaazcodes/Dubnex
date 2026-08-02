"""ORM model for durable project / job metadata."""

from __future__ import annotations

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from services.db import Base


class ProjectRow(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    voice: Mapped[str | None] = mapped_column(String(128), nullable=True)

    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    storage_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    processing_time: Mapped[str | None] = mapped_column(String(64), nullable=True)
    processing_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    translation_model: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tts_model: Mapped[str | None] = mapped_column(String(256), nullable=True)

    duration: Mapped[str | None] = mapped_column(String(64), nullable=True)
    size: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)

    # JSON payloads
    transcript_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_history_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_timings_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    renders_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    versions_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    completed_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
