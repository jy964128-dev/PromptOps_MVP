"""
数据库连接配置
引用 docs/02_Tech_Plan.md & docs/06_DB_Init.md
支持 SQLite（开发）和 PostgreSQL（生产）
"""
import os
from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 优先使用环境变量（生产环境），否则使用 SQLite（开发环境）
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./promptops.db"  # 默认 SQLite
)

# 如果是 PostgreSQL，需要处理连接字符串格式
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") or SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    # Render 和其他平台可能使用 postgres:// 或 postgresql://
    # 统一转换为 postgresql+psycopg2:// 格式
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        # 将 postgres:// 转换为 postgresql://
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # 确保使用 psycopg2 适配器
    if "psycopg2" not in SQLALCHEMY_DATABASE_URL:
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    # 处理 Render 的特殊情况：检查并修复连接字符串
    try:
        parsed = urlparse(SQLALCHEMY_DATABASE_URL)
        # 调试信息：输出解析后的连接信息（隐藏密码）
        safe_url = SQLALCHEMY_DATABASE_URL
        if parsed.password:
            safe_url = SQLALCHEMY_DATABASE_URL.replace(f":{parsed.password}@", ":****@")
        print(f"数据库连接信息: {parsed.scheme}://{parsed.username}@****/{parsed.path.lstrip('/')}")
        print(f"主机名: {parsed.hostname}, 端口: {parsed.port or '默认(5432)'}")
        
        # 检查主机名是否完整
        if parsed.hostname and not parsed.hostname.endswith(('.com', '.net', '.org', '.io', '.app', '.render.com')):
            # 如果主机名看起来不完整（例如只有 "dpg-xxx-a"），可能是 Render 的内部 URL
            # Render 的内部 URL 通常格式为: dpg-xxx-a.render.com 或 dpg-xxx-a.singapore-postgres.render.com
            # 但有时可能只提供短主机名，需要检查是否是 Internal Database URL
            print(f"警告: 主机名 '{parsed.hostname}' 看起来不完整，可能是 Render Internal Database URL")
            print("提示: 如果连接失败，请确保使用正确的 DATABASE_URL（Internal 或 External）")
    except Exception as e:
        # 如果解析失败，记录错误但继续使用原始 URL
        print(f"警告: 无法解析 DATABASE_URL: {e}")
        print(f"使用原始连接字符串: {SQLALCHEMY_DATABASE_URL[:50]}...")

# 获取当前代码读到的地址
current_url = os.getenv("DATABASE_URL") # 确保这里的键名和你Render里设置的一样

# 打印出来（在Render日志里看）
print(f"唐小果--- DEBUG INFO ---")
print(f"The code thinks the URL is: {current_url}")
print(f"糖小果--- DEBUG END ---")

def _create_engine():
    """构建 SQLAlchemy 引擎"""
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        # SQLite 配置（开发环境）
        return create_engine(
            SQLALCHEMY_DATABASE_URL,
            connect_args={"check_same_thread": False},
            echo=os.getenv("DEBUG", "false").lower() == "true",
        )
    else:
        # PostgreSQL 配置（生产环境）
        return create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,  # 连接池健康检查
            pool_size=5,
            max_overflow=10,
            echo=os.getenv("DEBUG", "false").lower() == "true",
        )


engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    FastAPI Depends 使用的 Session 生成器
    注意：必须使用生成器函数（yield），不能使用 @contextmanager
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库表"""
    # 延迟导入，避免循环引用
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)





