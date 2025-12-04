"""
FastAPI 主应用入口
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from . import models  # noqa: F401
from .api.prompts import router as prompts_router
from .api.projects import router as projects_router
from .api.run import router as run_router
from .api.stats import router as stats_router

# 创建 FastAPI 应用实例
app = FastAPI(
    title="PromptOps API",
    description="Prompt 生命周期管理系统 API",
    version="1.0.0",
)

# 配置 CORS（跨域资源共享）
# 从环境变量读取允许的来源，生产环境应设置具体的前端域名
cors_origins = os.getenv("CORS_ORIGINS", "*")
if cors_origins != "*":
    # 支持多个域名，用逗号分隔
    cors_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(prompts_router)
app.include_router(projects_router)
app.include_router(run_router)
app.include_router(stats_router)


@app.on_event("startup")
async def startup_event():
    """
    应用启动时初始化数据库
    """
    init_db()
    print("数据库初始化完成")


@app.get("/")
async def root():
    """
    根路径，健康检查
    """
    return {
        "message": "PromptOps API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """
    健康检查端点
    """
    return {"status": "healthy"}

