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
import io

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse, Response
import pandas as pd

from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


def _normalize_compiled_template(template: str | dict | None) -> dict:
    """
    标准化 compiled_template 为 JSON 格式：{"zh": "...", "en": "..."}
    兼容旧数据（字符串格式）和新数据（JSON 格式）
    """
    if template is None:
        return {"zh": "", "en": ""}
    
    if isinstance(template, dict):
        # 已经是 JSON 格式，确保有 zh 和 en 字段
        return {
            "zh": template.get("zh", ""),
            "en": template.get("en", ""),
        }
    
    if isinstance(template, str):
        # 旧数据：字符串格式，转换为 JSON（放在 zh 字段）
        return {"zh": template, "en": ""}
    
    return {"zh": "", "en": ""}


def _get_compiled_template_text(template: dict | str | None, lang: str = "zh") -> str:
    """
    从 JSON 格式的 compiled_template 中提取指定语言的文本
    兼容旧数据（字符串格式）
    """
    if template is None:
        return ""
    
    if isinstance(template, dict):
        return template.get(lang, "")
    
    if isinstance(template, str):
        # 旧数据：字符串格式，只有中文
        return template if lang == "zh" else ""
    
    return ""


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
        compiled_template=_normalize_compiled_template(payload.compiled_template),
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
    导出所有提示词为 Excel 格式
    包含完整的提示词信息和版本信息
    注意：此路由必须在 /{prompt_id} 之前定义，避免路由冲突
    """
    prompts = db.query(models.Prompt).order_by(models.Prompt.created_at.desc()).all()
    
    export_data = []
    for prompt in prompts:
        latest_version = _get_latest_version(prompt)
        compiled_template = _normalize_compiled_template(latest_version.compiled_template) if latest_version else {"zh": "", "en": ""}
        
        # 将复杂字段转换为字符串以便在 Excel 中显示
        structure_str = json.dumps(latest_version.structure_json, ensure_ascii=False) if latest_version and latest_version.structure_json else ""
        config_str = json.dumps(latest_version.config_json, ensure_ascii=False) if latest_version and latest_version.config_json else ""
        variables_str = json.dumps(latest_version.variables, ensure_ascii=False) if latest_version and latest_version.variables else ""
        
        prompt_data = {
            "名称": prompt.name,
            "别名 (Slug)": prompt.slug,
            "描述": prompt.description or "",
            "项目类别": prompt.project.name if prompt.project else "",
            "版本号": latest_version.version_num if latest_version else "1.0.0",
            "提示词内容 (中文)": compiled_template.get("zh", ""),
            "提示词内容 (英文)": compiled_template.get("en", ""),
            "结构化数据": structure_str,
            "配置信息": config_str,
            "变量": variables_str,
        }
        export_data.append(prompt_data)
    
    # 创建 DataFrame
    df = pd.DataFrame(export_data)
    
    # 创建 Excel 文件
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='提示词列表')
        # 自动调整列宽
        worksheet = writer.sheets['提示词列表']
        for idx, col in enumerate(df.columns):
            max_length = max(
                df[col].astype(str).map(len).max(),
                len(str(col))
            )
            # 限制最大宽度为 50
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[chr(65 + idx)].width = adjusted_width
    
    output.seek(0)
    
    # 返回 Excel 文件
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="prompts_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.xlsx"'
        }
    )


@router.post("/import")
async def import_prompts(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    从 Excel 文件导入提示词
    支持批量导入，如果 slug 已存在则跳过
    注意：此路由必须在 /{prompt_id} 之前定义，避免路由冲突
    """
    try:
        # 读取文件内容
        content = await file.read()
        
        # 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请上传 Excel 文件（.xlsx 或 .xls 格式）"
            )
        
        # 读取 Excel 文件
        try:
            df = pd.read_excel(io.BytesIO(content), sheet_name=0)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无法读取 Excel 文件：{str(e)}"
            )
        
        # 验证必需的列
        required_columns = ["名称", "别名 (Slug)"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Excel 文件缺少必需的列：{', '.join(missing_columns)}"
            )
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        # 遍历每一行
        for idx, row in df.iterrows():
            try:
                # 获取数据（处理 NaN 值）
                name = str(row.get("名称", "")).strip()
                slug = str(row.get("别名 (Slug)", "")).strip()
                
                # 验证必需字段
                if not name or not slug or name == "nan" or slug == "nan":
                    errors.append(f"第 {idx + 2} 行：缺少名称或别名 (Slug)")
                    skipped_count += 1
                    continue
                
                # 检查 slug 是否已存在
                existing = db.query(models.Prompt).filter(
                    models.Prompt.slug == slug
                ).first()
                
                if existing:
                    skipped_count += 1
                    continue
                
                # 获取其他字段
                description = str(row.get("描述", "")).strip() if pd.notna(row.get("描述")) else None
                if description == "nan":
                    description = None
                
                project_name = str(row.get("项目类别", "")).strip() if pd.notna(row.get("项目类别")) else None
                if project_name == "nan":
                    project_name = None
                
                version = str(row.get("版本号", "1.0.0")).strip() if pd.notna(row.get("版本号")) else "1.0.0"
                if version == "nan":
                    version = "1.0.0"
                
                # 处理提示词内容
                template_zh = str(row.get("提示词内容 (中文)", "")).strip() if pd.notna(row.get("提示词内容 (中文)")) else ""
                template_en = str(row.get("提示词内容 (英文)", "")).strip() if pd.notna(row.get("提示词内容 (英文)")) else ""
                if template_zh == "nan":
                    template_zh = ""
                if template_en == "nan":
                    template_en = ""
                
                compiled_template = {"zh": template_zh, "en": template_en}
                
                # 处理结构化数据
                structure_str = str(row.get("结构化数据", "")).strip() if pd.notna(row.get("结构化数据")) else ""
                structure_json = None
                if structure_str and structure_str != "nan":
                    try:
                        structure_json = json.loads(structure_str)
                    except:
                        structure_json = None
                
                # 处理配置信息
                config_str = str(row.get("配置信息", "")).strip() if pd.notna(row.get("配置信息")) else ""
                config_json = {}
                if config_str and config_str != "nan":
                    try:
                        config_json = json.loads(config_str)
                    except:
                        config_json = {}
                
                # 处理变量
                variables_str = str(row.get("变量", "")).strip() if pd.notna(row.get("变量")) else ""
                variables = []
                if variables_str and variables_str != "nan":
                    try:
                        variables = json.loads(variables_str)
                        if not isinstance(variables, list):
                            variables = []
                    except:
                        variables = []
                
                # 创建项目（如果指定了项目名称）
                project = _get_or_create_project(db, project_name)
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
                    name=name,
                    slug=slug,
                    description=description,
                    project=project,
                )
                db.add(prompt)
                db.flush()
                
                # 创建版本
                version = models.PromptVersion(
                    prompt_id=prompt.id,
                    version_num=version,
                    is_published=False,
                    compiled_template=compiled_template,
                    structure_json=structure_json,
                    variables=variables,
                    config_json=config_json,
                )
                db.add(version)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第 {idx + 2} 行导入失败：{str(e)}")
                skipped_count += 1
                continue
        
        db.commit()
        
        return {
            "message": "导入完成",
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors if errors else None,
        }
        
    except HTTPException:
        raise
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
            latest_version.compiled_template = _normalize_compiled_template(payload.compiled_template)

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
        compiled_template=_normalize_compiled_template(latest_version.compiled_template) if latest_version else {"zh": "", "en": ""},
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
            compiled_template=_normalize_compiled_template(None),
            structure_json=None,
            variables=[],
            config_json={},
        )
        db.add(latest_version)

    if payload.version is not None:
        latest_version.version_num = payload.version
    if payload.compiled_template is not None:
        latest_version.compiled_template = _normalize_compiled_template(payload.compiled_template)
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


