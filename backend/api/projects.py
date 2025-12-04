"""
项目相关 API

提供：
- 列表：GET /api/v1/projects
- 新建：POST /api/v1/projects
- 更新：PUT /api/v1/projects/{project_id}
- 删除：DELETE /api/v1/projects/{project_id}
- 获取项目下的提示词：GET /api/v1/projects/{project_id}/prompts
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from .. import models, schemas
from .prompts import _to_prompt_item

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=List[schemas.ProjectItem])
def list_projects(db: Session = Depends(get_db)) -> list[schemas.ProjectItem]:
    """
    获取所有项目列表（含每个项目的 Prompt 数量）
    """
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    
    result = []
    for project in projects:
        # 统计该项目的 Prompt 数量
        prompt_count = db.query(func.count(models.Prompt.id)).filter(
            models.Prompt.project_id == project.id
        ).scalar() or 0
        
        result.append(
            schemas.ProjectItem(
                id=project.id,
                name=project.name,
                description=project.description,
                prompt_count=prompt_count,
            )
        )
    
    return result


@router.post("", response_model=schemas.ProjectItem, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: schemas.ProjectCreate, db: Session = Depends(get_db)
) -> schemas.ProjectItem:
    """
    新建一个项目
    """
    # 检查名称唯一性
    exists = db.query(models.Project).filter(models.Project.name == payload.name).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="项目名称已存在"
        )

    project = models.Project(
        name=payload.name,
        description=payload.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return schemas.ProjectItem(
        id=project.id,
        name=project.name,
        description=project.description,
        prompt_count=0,
    )


@router.put("/{project_id}", response_model=schemas.ProjectItem)
def update_project(
    project_id: str, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)
) -> schemas.ProjectItem:
    """
    更新项目信息
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    if payload.name is not None:
        # 检查名称冲突
        conflict = (
            db.query(models.Project)
            .filter(models.Project.name == payload.name, models.Project.id != project_id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="项目名称已被使用"
            )
        project.name = payload.name

    if payload.description is not None:
        project.description = payload.description

    db.commit()
    db.refresh(project)

    # 统计 Prompt 数量
    prompt_count = db.query(func.count(models.Prompt.id)).filter(
        models.Prompt.project_id == project.id
    ).scalar() or 0

    return schemas.ProjectItem(
        id=project.id,
        name=project.name,
        description=project.description,
        prompt_count=prompt_count,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """
    删除项目（会级联删除该项目的所有 Prompt）
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    # 检查项目是否有提示词
    prompt_count = db.query(func.count(models.Prompt.id)).filter(
        models.Prompt.project_id == project_id
    ).scalar() or 0
    
    if prompt_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"项目包含 {prompt_count} 个提示词，无法删除。请先删除或移动这些提示词。"
        )

    db.delete(project)
    db.commit()
    return None


@router.delete("/empty/batch", status_code=status.HTTP_200_OK)
def delete_empty_projects(db: Session = Depends(get_db)):
    """
    批量删除所有空项目（没有提示词的项目）
    返回删除的项目数量
    """
    # 查找所有空项目
    all_projects = db.query(models.Project).all()
    empty_projects = []
    
    for project in all_projects:
        prompt_count = db.query(func.count(models.Prompt.id)).filter(
            models.Prompt.project_id == project.id
        ).scalar() or 0
        
        if prompt_count == 0:
            empty_projects.append(project)
    
    # 删除所有空项目
    deleted_count = len(empty_projects)
    for project in empty_projects:
        db.delete(project)
    
    db.commit()
    
    return {
        "deleted_count": deleted_count,
        "message": f"成功删除 {deleted_count} 个空项目"
    }


@router.get("/{project_id}/prompts", response_model=List[schemas.PromptItem])
def get_project_prompts(
    project_id: str, db: Session = Depends(get_db)
) -> list[schemas.PromptItem]:
    """
    获取指定项目下的所有 Prompt
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    prompts = (
        db.query(models.Prompt)
        .filter(models.Prompt.project_id == project_id)
        .order_by(models.Prompt.created_at.desc())
        .all()
    )

    return [_to_prompt_item(p) for p in prompts]

