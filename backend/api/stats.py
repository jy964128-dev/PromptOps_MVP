"""
统计相关 API - 用于大屏展示
"""
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/overview")
def get_overview_stats(db: Session = Depends(get_db)):
    """
    获取总体统计信息
    """
    total_prompts = db.query(func.count(models.Prompt.id)).scalar() or 0
    total_projects = db.query(func.count(models.Project.id)).scalar() or 0
    total_versions = db.query(func.count(models.PromptVersion.id)).scalar() or 0
    
    # 最近7天创建的提示词数量
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_prompts = (
        db.query(func.count(models.Prompt.id))
        .filter(models.Prompt.created_at >= seven_days_ago)
        .scalar() or 0
    )
    
    return {
        "total_prompts": total_prompts,
        "total_projects": total_projects,
        "total_versions": total_versions,
        "recent_prompts": recent_prompts,
    }


@router.get("/trends")
def get_trends(db: Session = Depends(get_db)):
    """
    获取提示词创建趋势（最近30天）
    注意：SQLite 使用 date() 函数，需要特殊处理
    """
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # 获取所有符合条件的提示词，在 Python 中按日期分组
    all_prompts = (
        db.query(models.Prompt)
        .filter(models.Prompt.created_at >= thirty_days_ago)
        .all()
    )
    
    # 在 Python 中按日期分组统计
    date_counts = defaultdict(int)
    
    for prompt in all_prompts:
        if prompt.created_at:
            date_key = prompt.created_at.date()
            date_counts[date_key] += 1
    
    # 转换为列表并排序
    trends = [
        {
            "date": date.strftime("%Y-%m-%d"),
            "count": count,
        }
        for date, count in sorted(date_counts.items())
    ]
    
    return trends


@router.get("/project-distribution")
def get_project_distribution(db: Session = Depends(get_db)):
    """
    获取项目分布统计
    """
    # 统计每个项目的提示词数量
    distribution = (
        db.query(
            models.Project.name,
            func.count(models.Prompt.id).label("count"),
        )
        .outerjoin(models.Prompt, models.Project.id == models.Prompt.project_id)
        .group_by(models.Project.id, models.Project.name)
        .order_by(func.count(models.Prompt.id).desc())
        .limit(10)
        .all()
    )
    
    # 注意：根据 models.py，project_id 是 NOT NULL
    # 所以所有提示词都必须属于某个项目，没有"未分类"的概念
    result = [
        {"name": item.name, "count": item.count} for item in distribution if item.count > 0
    ]
    
    return result


@router.get("/recent-prompts")
def get_recent_prompts(db: Session = Depends(get_db)):
    """
    获取最近创建的提示词（前10个）
    """
    recent = (
        db.query(models.Prompt)
        .order_by(models.Prompt.created_at.desc())
        .limit(10)
        .all()
    )
    
    result = []
    for p in recent:
        try:
            result.append({
                "id": p.id,
                "name": p.name or "",
                "slug": p.slug or "",
                "created_at": p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "",
                "project_name": (
                    p.project.name if p.project else None
                ),
            })
        except Exception:
            # 跳过有问题的记录
            continue
    
    return result


@router.get("/version-stats")
def get_version_stats(db: Session = Depends(get_db)):
    """
    获取版本统计信息
    """
    # 统计每个提示词的版本数量
    version_counts = (
        db.query(
            func.count(models.PromptVersion.id).label("version_count"),
            func.count(func.distinct(models.PromptVersion.prompt_id)).label("prompt_count"),
        )
        .first()
    )
    
    avg_versions = 0
    if version_counts and version_counts.prompt_count > 0:
        avg_versions = round(version_counts.version_count / version_counts.prompt_count, 2)
    
    return {
        "total_versions": version_counts.version_count if version_counts else 0,
        "prompts_with_versions": version_counts.prompt_count if version_counts else 0,
        "avg_versions_per_prompt": avg_versions,
    }

