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
from .api.export import router as export_router

# 创建 FastAPI 应用实例
app = FastAPI(
    title="PromptOps API",
    description="Prompt 生命周期管理系统 API",
    version="1.0.0",
)

# 配置 CORS（跨域资源共享）
# 注意：当 allow_credentials=True 时，不能使用 allow_origins=["*"]，必须明确列出域名

# 默认的生产环境域名（始终包含）
default_production_origins = [
    "https://prompt-ops-foi5sjagp-jy964128-2933s-projects.vercel.app",
    "https://prompt-ops-mvp-blush.vercel.app",
]

# 开发环境的 localhost 端口
dev_origins = []
for port in [3000, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 8080, 8081]:
    dev_origins.extend([
        f"http://localhost:{port}",
        f"http://127.0.0.1:{port}",
    ])

# 获取环境变量中的 CORS 配置
cors_origins_env = os.getenv("CORS_ORIGINS", "")

if cors_origins_env:
    # 如果设置了环境变量，使用环境变量 + 默认生产域名（去重）
    env_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    cors_origins = list(set(env_origins + default_production_origins))
    print(f"🌐 CORS 配置: 使用环境变量 + 默认域名，允许的来源 = {cors_origins}")
else:
    # 如果没有设置环境变量，使用开发端口 + 生产域名
    cors_origins = list(set(dev_origins + default_production_origins))
    print(f"🌐 CORS 配置: 使用默认配置，允许的来源 = {len(cors_origins)} 个")
    print(f"   包含生产域名: {default_production_origins}")

# 只添加一个 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 注册路由
app.include_router(prompts_router)
app.include_router(projects_router)
app.include_router(run_router)
app.include_router(stats_router)
app.include_router(export_router)


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


@app.get("/test-cors")
async def test_cors():
    """
    测试 CORS 配置的端点
    用于验证 CORS 头是否正确设置
    """
    return {
        "message": "CORS test endpoint",
        "cors_configured": True,
    }


# 注意：不需要手动处理 OPTIONS 请求
# FastAPI 的 CORSMiddleware 会自动处理所有 OPTIONS 预检请求

