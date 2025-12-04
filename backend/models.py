"""
SQLAlchemy 模型定义
参考 docs/06_DB_Init.md
"""
from datetime import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid() -> str:
    """SQLite 不支持 uuid-ossp，使用 Python 生成"""
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid, comment="项目 ID")
    name = Column(String(255), nullable=False, comment="项目名称")
    description = Column(Text, comment="描述")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间"
    )

    prompts = relationship(
        "Prompt", back_populates="project", cascade="all, delete-orphan"
    )


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True)
    description = Column(Text)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project = relationship("Project", back_populates="prompts")
    versions = relationship(
        "PromptVersion", back_populates="prompt", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_prompts_project_id", "project_id"),)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    prompt_id = Column(
        String(36), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False
    )
    version_num = Column(String(50))
    is_published = Column(Boolean, default=False)
    structure_json = Column(JSON)
    compiled_template = Column(Text, nullable=False)
    variables = Column(JSON, default=lambda: [])
    config_json = Column(JSON, nullable=False, default=lambda: {})
    commit_message = Column(Text)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    prompt = relationship("Prompt", back_populates="versions")

    __table_args__ = (Index("idx_versions_prompt_id", "prompt_id"),)


class UserAPIKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("idx_user_api_keys_user_provider", "user_id", "provider", unique=True),)


