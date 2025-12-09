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
# --- 配置 CORS (核心修改在这里) ---
origins = [
    "http://localhost:3000",             # 本地开发前端
    "http://localhost:5173",             # Vite 本地默认端口
    "https://prompt-ops-foi5sjagp-jy964128-2933s-projects.vercel.app", 
    "https://prompt-ops-mvp-blush.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # 这里使用了上面的列表
    allow_credentials=True,
    allow_methods=["*"],     # 允许所有方法 (GET, POST, PUT, DELETE等)
    allow_headers=["*"],     # 允许所有 Header
)
# 配置 CORS（跨域资源共享）
# 开发环境：明确列出常见端口 + 正则表达式匹配其他端口
# 生产环境：通过环境变量 CORS_ORIGINS 设置具体域名
cors_origins_env = os.getenv("CORS_ORIGINS", "")

if cors_origins_env:
    # 生产环境：使用环境变量中指定的域名
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # 开发环境：明确列出所有可能的 localhost 端口
    # 注意：当 allow_credentials=True 时，不能使用 ["*"]，必须明确列出
    # 使用较大的端口范围覆盖 Vite 可能使用的所有端口
    dev_origins = []
    # 添加常见的开发端口
    for port in [3000, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 8080, 8081]:
        dev_origins.extend([
            f"http://localhost:{port}",
            f"http://127.0.0.1:{port}",
        ])
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=dev_origins,
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
    
    # 输出 CORS 配置信息
    cors_origins_env = os.getenv("CORS_ORIGINS", "")
    if cors_origins_env:
        print(f"🌐 CORS 配置: 允许的来源 = {cors_origins_env}")
    else:
        print("🌐 CORS 配置: 开发模式")
        print("   允许的端口: 3000, 5173-5180, 8080, 8081 (localhost 和 127.0.0.1)")


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


@app.options("/api/v1/prompts")
async def options_prompts():
    """
    CORS 预检请求处理（OPTIONS）
    确保 CORS 预检请求能正确响应
    """
    return {"status": "ok"}

