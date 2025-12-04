"""
数据库连接配置
引用 docs/02_Tech_Plan.md & docs/06_DB_Init.md
支持 SQLite（开发）和 PostgreSQL（生产）
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 优先使用环境变量（生产环境），否则使用 SQLite（开发环境）
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./promptops.db"  # 默认 SQLite
)

# 如果是 PostgreSQL，需要处理连接字符串格式
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://") and "psycopg2" not in SQLALCHEMY_DATABASE_URL:
    # 确保使用 psycopg2 适配器
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)


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





