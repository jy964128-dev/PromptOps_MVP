"""
数据库导出功能
将数据库中的所有表数据导出为Excel文件
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/v1/export", tags=["导出"])


def serialize_value(value: Any) -> Any:
    """
    序列化值，将复杂类型转换为字符串
    对于JSON字段，使用格式化的JSON字符串，便于阅读
    """
    if value is None:
        return ""
    elif isinstance(value, dict):
        # JSON字典格式化为易读的字符串
        try:
            return json.dumps(value, ensure_ascii=False, indent=2)
        except (TypeError, ValueError):
            return str(value)
    elif isinstance(value, list):
        # JSON列表格式化为易读的字符串
        try:
            return json.dumps(value, ensure_ascii=False, indent=2)
        except (TypeError, ValueError):
            return str(value)
    elif isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    elif isinstance(value, bool):
        return "是" if value else "否"
    else:
        return str(value) if value is not None else ""


def export_table_to_dataframe(db: Session, model_class) -> pd.DataFrame:
    """
    将数据库表导出为DataFrame
    确保所有字段都被导出，包括JSON字段的完整内容
    """
    try:
        records = db.query(model_class).all()
        if not records:
            # 返回空DataFrame，但保留列名
            columns = [col.name for col in model_class.__table__.columns]
            return pd.DataFrame(columns=columns)
        
        # 转换为字典列表
        data = []
        for record in records:
            row = {}
            # 遍历所有列，确保所有字段都被导出
            for column in model_class.__table__.columns:
                try:
                    value = getattr(record, column.name)
                    row[column.name] = serialize_value(value)
                except Exception as e:
                    # 如果某个字段获取失败，记录错误但继续导出其他字段
                    row[column.name] = f"[导出错误: {str(e)}]"
            data.append(row)
        
        df = pd.DataFrame(data)
        
        # 确保所有列都存在（防止某些列被遗漏）
        expected_columns = [col.name for col in model_class.__table__.columns]
        for col in expected_columns:
            if col not in df.columns:
                df[col] = ""
        
        # 按原始列顺序重新排列
        df = df[expected_columns]
        
        return df
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出表 {model_class.__tablename__} 失败: {str(e)}")


@router.post("/excel")
async def export_to_excel(db: Session = Depends(get_db)):
    """
    导出所有数据库表到Excel文件
    
    返回:
        - 文件路径信息
    """
    try:
        # 确保docs目录存在
        project_root = Path(__file__).parent.parent.parent
        docs_dir = project_root / "docs"
        docs_dir.mkdir(exist_ok=True)
        
        # 生成文件名（带时间戳）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        excel_filename = f"promptops_export_{timestamp}.xlsx"
        excel_path = docs_dir / excel_filename
        
        # 定义要导出的表
        tables = [
            ("项目", models.Project),
            ("提示词", models.Prompt),
            ("提示词版本", models.PromptVersion),
            ("用户API密钥", models.UserAPIKey),
        ]
        
        # 创建Excel写入器，设置选项以确保完整导出
        with pd.ExcelWriter(
            excel_path, 
            engine="openpyxl"
        ) as writer:
            for sheet_name, model_class in tables:
                df = export_table_to_dataframe(db, model_class)
                # 将DataFrame写入Excel工作表
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                
                # 获取工作表对象，设置列宽以便查看完整内容
                worksheet = writer.sheets[sheet_name]
                for idx, col in enumerate(df.columns):
                    # 设置列宽，根据内容自动调整
                    max_length = max(
                        df[col].astype(str).map(len).max() if len(df) > 0 else 0,
                        len(str(col))
                    )
                    # 限制最大宽度为50，最小宽度为10
                    adjusted_width = min(max(max_length + 2, 10), 50)
                    # 处理超过26列的情况（Z之后是AA, AB等）
                    if idx < 26:
                        col_letter = chr(65 + idx)
                    else:
                        col_letter = chr(65 + idx // 26 - 1) + chr(65 + idx % 26)
                    worksheet.column_dimensions[col_letter].width = adjusted_width
                
                # 设置文本换行，确保长文本可以完整显示
                from openpyxl.styles import Alignment
                for row in worksheet.iter_rows(min_row=2):  # 跳过标题行
                    for cell in row:
                        cell.alignment = Alignment(wrap_text=True, vertical='top')
        
        # 检查文件是否成功创建
        if not excel_path.exists():
            raise HTTPException(status_code=500, detail="Excel文件创建失败")
        
        file_size = excel_path.stat().st_size
        
        return {
            "message": "导出成功",
            "filename": excel_filename,
            "path": str(excel_path.relative_to(project_root)),
            "absolute_path": str(excel_path),
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "exported_tables": [name for name, _ in tables],
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/excel/info")
async def get_export_info(db: Session = Depends(get_db)):
    """
    获取导出信息（不实际导出）
    返回各表的记录数统计
    """
    try:
        tables = [
            ("项目", models.Project),
            ("提示词", models.Prompt),
            ("提示词版本", models.PromptVersion),
            ("用户API密钥", models.UserAPIKey),
        ]
        
        stats = []
        for name, model_class in tables:
            count = db.query(model_class).count()
            stats.append({
                "table_name": name,
                "model_name": model_class.__tablename__,
                "record_count": count,
            })
        
        return {
            "tables": stats,
            "total_tables": len(tables),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取导出信息失败: {str(e)}")

