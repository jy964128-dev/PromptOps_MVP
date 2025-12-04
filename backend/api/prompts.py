"""
Prompt 相关 API

提供：
- 列表：GET /api/v1/prompts
- 新建：POST /api/v1/prompts
- 更新：PUT /api/v1/prompts/{prompt_id}
- 删除：DELETE /api/v1/prompts/{prompt_id}
- 导出：GET /api/v1/prompts/export
- 导入：POST /api/v1/prompts/import
"""
from typing import List
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


def _get_or_create_project(db: Session, project_name: str | None) -> models.Project | None:
    """根据项目名称查找或创建项目"""
    if not project_name:
        return None

    project = (
        db.query(models.Project)
        .filter(models.Project.name == project_name)
        .one_or_none()
    )
    if project:
        return project

    project = models.Project(name=project_name)
    db.add(project)
    db.flush()  # 获取生成的 ID
    return project


def _to_prompt_item(prompt: models.Prompt) -> schemas.PromptItem:
    """将 ORM Prompt 转换为前端使用的视图模型"""
    # 取最近的版本（按 created_at 排序）
    latest_version = None
    if prompt.versions:
        latest_version = sorted(
            prompt.versions, key=lambda v: v.created_at or "", reverse=True
        )[0]

    return schemas.PromptItem(
        id=prompt.id,
        name=prompt.name,
        slug=prompt.slug,
        description=prompt.description,
        project_name=prompt.project.name if prompt.project else None,
        updated_at=(prompt.updated_at or prompt.created_at).strftime("%Y-%m-%d")
        if (prompt.updated_at or prompt.created_at)
        else "",
        version=latest_version.version_num if latest_version else None,
    )


def _get_latest_version(prompt: models.Prompt) -> models.PromptVersion | None:
    """获取最近一次版本"""
    if not prompt.versions:
        return None
    return sorted(
        prompt.versions, key=lambda v: v.created_at or "", reverse=True
    )[0]


@router.get("", response_model=List[schemas.PromptItem])
def list_prompts(db: Session = Depends(get_db)) -> list[schemas.PromptItem]:
    """
    获取所有 Prompt 列表（含最近版本信息）
    """
    prompts = db.query(models.Prompt).order_by(models.Prompt.created_at.desc()).all()
    return [_to_prompt_item(p) for p in prompts]


@router.post("", response_model=schemas.PromptItem, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: schemas.PromptCreate, db: Session = Depends(get_db)
) -> schemas.PromptItem:
    """
    新建一个 Prompt，同时创建一个版本记录
    """
    # 检查 slug 唯一性
    exists = db.query(models.Prompt).filter(models.Prompt.slug == payload.slug).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Slug 已存在，请更换别名"
        )

    project = _get_or_create_project(db, payload.project_name)
    if not project:
        # project_id 是 NOT NULL，必须有一个项目
        default_project = db.query(models.Project).filter(
            models.Project.name == "默认项目"
        ).first()
        if not default_project:
            default_project = models.Project(name="默认项目", description="默认项目")
            db.add(default_project)
            db.flush()
        project = default_project

    prompt = models.Prompt(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        project=project,
    )
    db.add(prompt)
    db.flush()

    version = models.PromptVersion(
        prompt_id=prompt.id,
        version_num=payload.version or "1.0.0",
        is_published=False,
        compiled_template=payload.compiled_template or "",
        structure_json=None,
        variables=[],
        config_json={},
    )
    db.add(version)
    db.commit()
    db.refresh(prompt)

    return _to_prompt_item(prompt)


@router.get("/export")
def export_prompts(db: Session = Depends(get_db)):
    """
    导出所有提示词为 JSON 格式
    包含完整的提示词信息和版本信息
    注意：此路由必须在 /{prompt_id} 之前定义，避免路由冲突
    """
    prompts = db.query(models.Prompt).order_by(models.Prompt.created_at.desc()).all()
    
    export_data = []
    for prompt in prompts:
        latest_version = _get_latest_version(prompt)
        
        prompt_data = {
            "name": prompt.name,
            "slug": prompt.slug,
            "description": prompt.description,
            "project_name": prompt.project.name if prompt.project else None,
            "version": latest_version.version_num if latest_version else "1.0.0",
            "compiled_template": latest_version.compiled_template if latest_version else "",
            "structure": latest_version.structure_json if latest_version and latest_version.structure_json else None,
            "config_json": latest_version.config_json if latest_version else {},
            "variables": latest_version.variables if latest_version else [],
        }
        export_data.append(prompt_data)
    
    return JSONResponse(
        content={
            "version": "1.0",
            "export_date": datetime.utcnow().isoformat(),
            "count": len(export_data),
            "prompts": export_data,
        },
        headers={
            "Content-Disposition": f'attachment; filename="prompts_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json"'
        }
    )


@router.post("/import")
async def import_prompts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    从 JSON 文件导入提示词
    支持批量导入，如果 slug 已存在则跳过
    注意：此路由必须在 /{prompt_id} 之前定义，避免路由冲突
    """
    try:
        # 读取文件内容
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        # 验证数据格式
        if not isinstance(data, dict) or "prompts" not in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的导入文件格式，需要包含 'prompts' 字段"
            )
        
        prompts_data = data["prompts"]
        if not isinstance(prompts_data, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'prompts' 必须是数组"
            )
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for idx, prompt_data in enumerate(prompts_data):
            try:
                # 验证必需字段
                if not prompt_data.get("name") or not prompt_data.get("slug"):
                    errors.append(f"第 {idx + 1} 条：缺少 name 或 slug 字段")
                    skipped_count += 1
                    continue
                
                # 检查 slug 是否已存在
                existing = db.query(models.Prompt).filter(
                    models.Prompt.slug == prompt_data["slug"]
                ).first()
                
                if existing:
                    # 如果已存在，跳过（也可以选择更新，这里采用跳过策略）
                    skipped_count += 1
                    continue
                
                # 创建项目（如果指定了项目名称）
                # 注意：project_id 是 NOT NULL，所以必须有一个项目
                project = _get_or_create_project(db, prompt_data.get("project_name"))
                if not project:
                    # 如果没有指定项目，创建一个默认项目
                    default_project = db.query(models.Project).filter(
                        models.Project.name == "默认项目"
                    ).first()
                    if not default_project:
                        default_project = models.Project(name="默认项目", description="导入的提示词默认项目")
                        db.add(default_project)
                        db.flush()
                    project = default_project
                
                # 创建提示词
                prompt = models.Prompt(
                    name=prompt_data["name"],
                    slug=prompt_data["slug"],
                    description=prompt_data.get("description"),
                    project=project,
                )
                db.add(prompt)
                db.flush()
                
                # 创建版本
                version = models.PromptVersion(
                    prompt_id=prompt.id,
                    version_num=prompt_data.get("version", "1.0.0"),
                    is_published=False,
                    compiled_template=prompt_data.get("compiled_template", ""),
                    structure_json=prompt_data.get("structure"),
                    variables=prompt_data.get("variables", []),
                    config_json=prompt_data.get("config_json", {}),
                )
                db.add(version)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx + 1} 条导入失败：{str(e)}")
                skipped_count += 1
                continue
        
        db.commit()
        
        return {
            "message": "导入完成",
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors if errors else None,
        }
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的 JSON 格式"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败：{str(e)}"
        )


@router.put("/{prompt_id}", response_model=schemas.PromptItem)
def update_prompt(
    prompt_id: str, payload: schemas.PromptUpdate, db: Session = Depends(get_db)
) -> schemas.PromptItem:
    """
    更新 Prompt 及其最近一次版本（仅修改传入的字段）
    """
    prompt = db.query(models.Prompt).filter(models.Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt 不存在")

    # 可选更新基础字段
    if payload.name is not None:
        prompt.name = payload.name
    if payload.slug is not None:
        # 检查 slug 冲突
        conflict = (
            db.query(models.Prompt)
            .filter(models.Prompt.slug == payload.slug, models.Prompt.id != prompt_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Slug 已被其他 Prompt 使用"
            )
        prompt.slug = payload.slug
    if payload.description is not None:
        prompt.description = payload.description

    if payload.project_name is not None:
        project = _get_or_create_project(db, payload.project_name)
        prompt.project = project

    # 更新最近版本
    latest_version = _get_latest_version(prompt)

    if latest_version:
        if payload.version is not None:
            latest_version.version_num = payload.version
        if payload.compiled_template is not None:
            latest_version.compiled_template = payload.compiled_template

    db.commit()
    db.refresh(prompt)
    return _to_prompt_item(prompt)


@router.get("/{prompt_id}", response_model=schemas.PromptDetail)
def get_prompt_detail(
    prompt_id: str, db: Session = Depends(get_db)
) -> schemas.PromptDetail:
    """
    获取 Prompt 详情（含最近版本的结构化数据与模板）
    """
    prompt = db.query(models.Prompt).filter(models.Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt 不存在")

    latest_version = _get_latest_version(prompt)

    structure = None
    if latest_version and latest_version.structure_json:
        structure = schemas.PromptStructure(**latest_version.structure_json)

    return schemas.PromptDetail(
        id=prompt.id,
        name=prompt.name,
        slug=prompt.slug,
        description=prompt.description,
        project_name=prompt.project.name if prompt.project else None,
        updated_at=(prompt.updated_at or prompt.created_at).strftime("%Y-%m-%d")
        if (prompt.updated_at or prompt.created_at)
        else "",
        version=latest_version.version_num if latest_version else None,
        structure=structure,
        compiled_template=latest_version.compiled_template if latest_version else "",
        config_json=latest_version.config_json if latest_version else {},
    )


@router.put("/{prompt_id}/detail", response_model=schemas.PromptDetail)
def update_prompt_detail(
    prompt_id: str, payload: schemas.PromptDetailUpdate, db: Session = Depends(get_db)
) -> schemas.PromptDetail:
    """
    更新 Prompt 详情（基础信息 + 最近版本的结构化数据与模板）
    """
    prompt = db.query(models.Prompt).filter(models.Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt 不存在")

    # 基础字段
    if payload.name is not None:
        prompt.name = payload.name
    if payload.slug is not None:
        conflict = (
            db.query(models.Prompt)
            .filter(models.Prompt.slug == payload.slug, models.Prompt.id != prompt_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Slug 已被其他 Prompt 使用"
            )
        prompt.slug = payload.slug
    if payload.description is not None:
        prompt.description = payload.description
    if payload.project_name is not None:
        project = _get_or_create_project(db, payload.project_name)
        prompt.project = project

    latest_version = _get_latest_version(prompt)
    if not latest_version:
        latest_version = models.PromptVersion(
            prompt_id=prompt.id,
            version_num=payload.version or "1.0.0",
            is_published=False,
            compiled_template="",
            structure_json=None,
            variables=[],
            config_json={},
        )
        db.add(latest_version)

    if payload.version is not None:
        latest_version.version_num = payload.version
    if payload.compiled_template is not None:
        latest_version.compiled_template = payload.compiled_template
    if payload.structure is not None:
        latest_version.structure_json = payload.structure.model_dump()
    if payload.config_json is not None:
        latest_version.config_json = payload.config_json

    db.commit()
    db.refresh(prompt)
    return get_prompt_detail(prompt_id, db)


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(prompt_id: str, db: Session = Depends(get_db)):
    """
    删除 Prompt（会级联删除该 Prompt 的所有版本）
    """
    prompt = db.query(models.Prompt).filter(models.Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt 不存在")

    db.delete(prompt)
    db.commit()
    return None


