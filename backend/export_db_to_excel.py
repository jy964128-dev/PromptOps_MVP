"""
数据库导出脚本
直接运行此脚本可以将数据库导出为Excel文件到docs目录
使用方法: python -m backend.export_db_to_excel
"""
import json
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import text

from .database import SessionLocal, init_db, engine
from . import models


def serialize_value(value):
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


def safe_json_parse(value):
    """
    安全地解析JSON值，处理空字符串和无效JSON
    """
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            # 如果不是有效的JSON，返回原始字符串
            return value
    return value


def export_table_to_dataframe(db, model_class):
    """
    将数据库表导出为DataFrame
    使用原始SQL查询避免SQLAlchemy的JSON解析问题
    确保所有字段都被导出，包括JSON字段的完整内容
    """
    table_name = model_class.__table__.name
    columns = [col.name for col in model_class.__table__.columns]
    
    # 使用原始SQL查询，避免SQLAlchemy的JSON解析问题
    # 对于SQLite，JSON字段存储为TEXT，我们需要手动处理
    column_list = ", ".join(columns)
    query = f"SELECT {column_list} FROM {table_name}"
    
    try:
        # 使用pandas直接读取SQL，这样可以避免JSON解析问题
        # 使用engine连接，避免SQLAlchemy的JSON解析
        df = pd.read_sql_query(text(query), engine)
        
        # 手动处理JSON字段（如果字段类型是JSON）
        # 在SQLite中，JSON字段存储为TEXT，所以需要根据列名或类型判断
        json_columns = []
        for col in model_class.__table__.columns:
            # 检查列名是否包含json，或者类型是JSON
            col_type_str = str(type(col.type))
            if 'JSON' in col_type_str or 'json' in col.name.lower():
                json_columns.append(col.name)
        
        # 对于PromptVersion表，明确指定JSON字段
        if table_name == 'prompt_versions':
            json_columns = ['structure_json', 'compiled_template', 'variables', 'config_json']
        
        # 处理JSON字段
        for col_name in json_columns:
            if col_name in df.columns:
                df[col_name] = df[col_name].apply(
                    lambda x: serialize_value(safe_json_parse(x)) if pd.notna(x) else ""
                )
        
        # 处理其他字段类型
        for col_name in df.columns:
            if col_name not in json_columns:
                df[col_name] = df[col_name].apply(
                    lambda x: serialize_value(x) if pd.notna(x) else ""
                )
        
        # 确保所有列都存在（防止某些列被遗漏）
        for col in columns:
            if col not in df.columns:
                df[col] = ""
        
        # 按原始列顺序重新排列
        df = df[columns]
        
        return df
    
    except Exception as e:
        # 如果原始SQL查询失败，回退到ORM方式（但会捕获JSON解析错误）
        print(f"    警告: 使用原始SQL查询失败，尝试ORM方式: {str(e)}")
        try:
            # 尝试使用ORM，但捕获JSON解析错误
            records = db.query(model_class).all()
            if not records:
                return pd.DataFrame(columns=columns)
            
            data = []
            for record in records:
                row = {}
                for column in model_class.__table__.columns:
                    try:
                        value = getattr(record, column.name)
                        row[column.name] = serialize_value(value)
                    except Exception as e:
                        row[column.name] = f"[导出错误: {str(e)}]"
                data.append(row)
            
            df = pd.DataFrame(data)
            for col in columns:
                if col not in df.columns:
                    df[col] = ""
            df = df[columns]
            return df
        except Exception as e2:
            print(f"    ORM方式也失败: {str(e2)}")
            # 返回空DataFrame但保留列名
            return pd.DataFrame(columns=columns)


def main():
    """
    主函数：导出数据库到Excel
    """
    print("开始导出数据库...")
    
    # 初始化数据库（确保表存在）
    init_db()
    
    # 确保docs目录存在
    project_root = Path(__file__).parent.parent
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
    
    # 创建数据库会话
    db = SessionLocal()
    try:
        # 创建Excel写入器，设置选项以确保完整导出
        with pd.ExcelWriter(
            excel_path, 
            engine="openpyxl"
        ) as writer:
            for sheet_name, model_class in tables:
                print(f"  正在导出: {sheet_name}...")
                df = export_table_to_dataframe(db, model_class)
                record_count = len(df)
                column_count = len(df.columns)
                print(f"    - 记录数: {record_count}")
                print(f"    - 字段数: {column_count}")
                print(f"    - 字段列表: {', '.join(df.columns.tolist())}")
                
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
            print("❌ 错误: Excel文件创建失败")
            return
        
        file_size = excel_path.stat().st_size
        
        print("\n✅ 导出成功!")
        print(f"  文件名: {excel_filename}")
        print(f"  路径: {excel_path.relative_to(project_root)}")
        print(f"  大小: {file_size / 1024:.2f} KB")
        print(f"  导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"\n导出的表:")
        for name, _ in tables:
            print(f"  - {name}")
    
    except Exception as e:
        print(f"❌ 导出失败: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

