# PromptOps 云平台部署指南

## 目录
1. [部署前准备](#部署前准备)
2. [数据库迁移](#数据库迁移)
3. [后端部署方案](#后端部署方案)
4. [前端部署方案](#前端部署方案)
5. [环境变量配置](#环境变量配置)
6. [Docker 部署（可选）](#docker-部署可选)

---

## 部署前准备

### 1. 代码准备
- ✅ 确保所有代码已提交到 Git 仓库
- ✅ 检查 `requirements.txt` 和 `package.json` 依赖完整
- ✅ 测试本地环境运行正常

### 2. 数据库准备
- 从 SQLite 迁移到 PostgreSQL（生产环境）
- 准备数据库连接字符串

---

## 数据库迁移

### 从 SQLite 迁移到 PostgreSQL

#### 步骤 1: 导出 SQLite 数据

```bash
# 在项目根目录执行
python -c "
from backend.database import engine
from backend import models
import json

# 导出数据
with engine.connect() as conn:
    prompts = conn.execute(models.Prompt.__table__.select()).fetchall()
    projects = conn.execute(models.Project.__table__.select()).fetchall()
    versions = conn.execute(models.PromptVersion.__table__.select()).fetchall()
    
    data = {
        'prompts': [dict(row._mapping) for row in prompts],
        'projects': [dict(row._mapping) for row in projects],
        'versions': [dict(row._mapping) for row in versions],
    }
    
    with open('data_export.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=str)
    
    print('数据导出完成: data_export.json')
"
```

#### 步骤 2: 修改数据库配置

修改 `backend/database.py`:

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 优先使用环境变量，否则使用 SQLite（开发环境）
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./promptops.db"  # 默认 SQLite
)

# 如果是 PostgreSQL，需要处理连接字符串格式
if DATABASE_URL.startswith("postgresql://"):
    # 确保使用 psycopg2 适配器
    if "postgresql://" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

def _create_engine():
    if DATABASE_URL.startswith("sqlite"):
        return create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False},
            echo=False,
        )
    else:
        # PostgreSQL 配置
        return create_engine(
            DATABASE_URL,
            pool_pre_ping=True,  # 连接池健康检查
            pool_size=5,
            max_overflow=10,
            echo=False,
        )

engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from . import models
    Base.metadata.create_all(bind=engine)
```

#### 步骤 3: 更新 requirements.txt

```txt
# 添加 PostgreSQL 驱动
psycopg2-binary==2.9.9
```

---

## 后端部署方案

### 方案 1: Railway（推荐，简单易用）

#### 步骤 1: 创建 Railway 项目
1. 访问 https://railway.app
2. 使用 GitHub 登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你的仓库

#### 步骤 2: 配置环境变量
在 Railway 项目设置中添加：
```
DATABASE_URL=postgresql://user:password@host:port/dbname
CORS_ORIGINS=https://your-frontend-domain.com
```

#### 步骤 3: 添加 PostgreSQL 服务
1. 在 Railway 项目中点击 "New" → "Database" → "PostgreSQL"
2. Railway 会自动创建数据库并设置 `DATABASE_URL` 环境变量

#### 步骤 4: 配置启动命令
在项目根目录创建 `Procfile`:
```
web: cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### 步骤 5: 配置构建命令
在 Railway 项目设置中：
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`

---

### 方案 2: Render

#### 步骤 1: 创建 Render 服务
1. 访问 https://render.com
2. 连接 GitHub 仓库
3. 选择 "New Web Service"
4. 配置：
   - **Name**: `promptops-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

#### 步骤 2: 添加 PostgreSQL 数据库
1. 在 Render Dashboard 中点击 "New" → "PostgreSQL"
2. 创建数据库实例
3. 在 Web Service 设置中添加环境变量：
   ```
   DATABASE_URL=<从 PostgreSQL 服务复制的 Internal Database URL>
   ```

---

### 方案 3: Fly.io

#### 步骤 1: 安装 Fly CLI
```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# 或使用 Scoop
scoop install flyctl
```

#### 步骤 2: 登录 Fly.io
```bash
fly auth login
```

#### 步骤 3: 创建 Fly.io 应用
```bash
cd backend
fly launch
```

#### 步骤 4: 创建 fly.toml 配置文件
```toml
app = "promptops-backend"
primary_region = "hkg"  # 选择离你最近的区域

[build]

[env]
  DATABASE_URL = "postgresql://user:pass@host:5432/dbname"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 8000
```

#### 步骤 5: 添加 PostgreSQL 数据库
```bash
fly postgres create --name promptops-db
fly postgres attach promptops-db
```

#### 步骤 6: 部署
```bash
fly deploy
```

---

### 方案 4: Heroku（传统方案）

#### 步骤 1: 安装 Heroku CLI
```bash
# 使用 Scoop
scoop install heroku
```

#### 步骤 2: 登录并创建应用
```bash
heroku login
heroku create promptops-backend
```

#### 步骤 3: 添加 PostgreSQL
```bash
heroku addons:create heroku-postgresql:mini
```

#### 步骤 4: 配置环境变量
```bash
heroku config:set CORS_ORIGINS=https://your-frontend-domain.com
```

#### 步骤 5: 创建 Procfile
在项目根目录创建 `Procfile`:
```
web: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### 步骤 6: 部署
```bash
git push heroku main
```

---

## 前端部署方案

### 方案 1: Vercel（推荐，最适合 React）

#### 步骤 1: 准备构建配置
修改 `backend/frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
```

#### 步骤 2: 创建 vercel.json
在 `backend/frontend/` 目录创建 `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-backend-domain.com/api/$1"
    }
  ]
}
```

#### 步骤 3: 部署到 Vercel
1. 访问 https://vercel.com
2. 使用 GitHub 登录
3. 点击 "Add New Project"
4. 选择仓库，设置：
   - **Framework Preset**: Vite
   - **Root Directory**: `backend/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### 步骤 4: 配置环境变量
在 Vercel 项目设置中添加：
```
VITE_API_BASE=https://your-backend-domain.com
```

---

### 方案 2: Netlify

#### 步骤 1: 创建 netlify.toml
在 `backend/frontend/` 目录创建 `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-domain.com/api/:splat"
  status = 200
  force = true
```

#### 步骤 2: 部署
1. 访问 https://netlify.com
2. 连接 GitHub 仓库
3. 设置：
   - **Base directory**: `backend/frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

---

### 方案 3: Cloudflare Pages

#### 步骤 1: 部署
1. 访问 https://pages.cloudflare.com
2. 连接 GitHub 仓库
3. 配置构建：
   - **Framework preset**: Vite
   - **Build command**: `cd backend/frontend && npm run build`
   - **Build output directory**: `backend/frontend/dist`

#### 步骤 2: 配置环境变量
在 Cloudflare Pages 设置中添加：
```
VITE_API_BASE=https://your-backend-domain.com
```

---

## 环境变量配置

### 后端环境变量

创建 `.env` 文件（不要提交到 Git）:
```bash
# 数据库
DATABASE_URL=postgresql://user:password@host:port/dbname

# CORS 配置
CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# 可选：API Keys（用于 LiteLLM）
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 前端环境变量

在 `backend/frontend/.env.production`:
```bash
VITE_API_BASE=https://your-backend-domain.com
```

在 `backend/frontend/.env.development`:
```bash
VITE_API_BASE=http://127.0.0.1:8000
```

修改 `backend/frontend/src/components/PromptList.tsx` 等文件：
```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
```

---

## Docker 部署（可选）

### 创建 Dockerfile

在项目根目录创建 `Dockerfile`:
```dockerfile
# 多阶段构建
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY backend/frontend/package*.json ./
RUN npm ci
COPY backend/frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 创建 docker-compose.yml
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: promptops
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: promptops
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    environment:
      DATABASE_URL: postgresql://promptops:your_password@db:5432/promptops
      CORS_ORIGINS: http://localhost:3000
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./backend:/app/backend

volumes:
  postgres_data:
```

### 部署到云平台（使用 Docker）

#### Railway
1. 在 Railway 项目设置中选择 "Dockerfile"
2. Railway 会自动检测并构建

#### Fly.io
```bash
fly deploy
```

#### Render
1. 在 Render 中选择 "Docker"
2. 自动检测 Dockerfile

---

## 部署检查清单

### 部署前
- [ ] 代码已提交到 Git
- [ ] 环境变量已配置
- [ ] 数据库已迁移到 PostgreSQL
- [ ] 依赖文件完整（requirements.txt, package.json）
- [ ] CORS 配置正确

### 部署后
- [ ] 后端 API 可访问（/health 端点）
- [ ] 前端页面正常加载
- [ ] API 调用正常
- [ ] 数据库连接正常
- [ ] 静态文件服务正常

---

## 常见问题

### Q1: CORS 错误
**解决**: 在 `backend/main.py` 中更新 CORS 配置：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Q2: 数据库连接失败
**解决**: 
- 检查 `DATABASE_URL` 格式
- 确保数据库服务已启动
- 检查防火墙规则

### Q3: 前端 API 调用失败
**解决**:
- 检查 `VITE_API_BASE` 环境变量
- 确认后端 URL 正确
- 检查 CORS 配置

---

## 推荐部署组合

### 方案 A: 简单快速（适合 MVP）
- **后端**: Railway
- **前端**: Vercel
- **数据库**: Railway PostgreSQL

### 方案 B: 成本优化
- **后端**: Render（免费 tier）
- **前端**: Netlify（免费 tier）
- **数据库**: Render PostgreSQL

### 方案 C: 高性能
- **后端**: Fly.io
- **前端**: Cloudflare Pages
- **数据库**: Fly.io PostgreSQL

---

## 下一步

部署完成后，建议：
1. 设置自定义域名
2. 配置 SSL 证书（大多数平台自动提供）
3. 设置监控和日志
4. 配置 CI/CD 自动部署
5. 设置备份策略

