"""
Pydantic 数据模型（Schemas）
用于 FastAPI 请求/响应
"""
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PromptBase(BaseModel):
    """Prompt 基础字段（供新建/编辑使用）"""

    name: str = Field(..., description="Prompt 名称")
    slug: str = Field(..., description="用于 API 调用的别名，如 resume-parser")
    description: Optional[str] = Field(None, description="Prompt 描述")
    project_name: Optional[str] = Field(
        None, description="所属项目名称（不存在时会自动创建）"
    )
    version: Optional[str] = Field("1.0.0", description="版本号，如 1.0.0")


class PromptCreate(PromptBase):
    """新建 Prompt 请求体"""

    compiled_template: Optional[str] = Field(
        "", description="编译后的模板文本（MVP 阶段可先为空）"
    )


class PromptUpdate(BaseModel):
    """更新 Prompt 请求体（全部字段可选）"""

    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    project_name: Optional[str] = None
    version: Optional[str] = None
    compiled_template: Optional[str] = None


class PromptItem(BaseModel):
    """前端列表展示用的 Prompt 视图模型"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    project_name: Optional[str] = None
    updated_at: str
    version: Optional[str] = None


class PromptStructure(BaseModel):
    """结构化 Prompt（Builder 模式）"""

    role: str = ""
    task: str = ""
    context: str = ""
    constraints: list[str] = []
    few_shot: list[dict[str, Any]] = []


class PromptDetail(BaseModel):
    """详情视图：用于 Builder / Code 编辑器"""

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    project_name: Optional[str] = None
    updated_at: str
    version: Optional[str] = None

    structure: PromptStructure | None = None
    compiled_template: str = ""
    config_json: dict[str, Any] = {}


class PromptDetailUpdate(BaseModel):
    """更新详情（包含结构化与 Code 文本）"""

    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    project_name: Optional[str] = None
    version: Optional[str] = None

    structure: Optional[PromptStructure] = None
    compiled_template: Optional[str] = None
    config_json: Optional[dict[str, Any]] = None


# ========== Project 相关 Schema ==========

class ProjectItem(BaseModel):
    """项目列表项"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    prompt_count: int = 0  # 该项目的 Prompt 数量


class ProjectCreate(BaseModel):
    """新建项目请求体"""

    name: str = Field(..., description="项目名称")
    description: Optional[str] = Field(None, description="项目描述")


class ProjectUpdate(BaseModel):
    """更新项目请求体"""

    name: Optional[str] = None
    description: Optional[str] = None
