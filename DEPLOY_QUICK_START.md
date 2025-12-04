# PromptOps 快速部署指南

## 🚀 最快部署方案（推荐）

### 后端：Railway + 前端：Vercel

#### 1. 后端部署（Railway）

1. **访问 Railway**: https://railway.app
2. **登录**: 使用 GitHub 账号登录
3. **创建项目**: 
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的仓库
4. **添加数据库**:
   - 点击 "New" → "Database" → "PostgreSQL"
   - Railway 会自动设置 `DATABASE_URL` 环境变量
5. **配置环境变量**（可选）:
   ```
   CORS_ORIGINS=https://your-frontend.vercel.app
   DEBUG=false
   ```
6. **部署**: Railway 会自动检测并部署

#### 2. 前端部署（Vercel）

1. **访问 Vercel**: https://vercel.com
2. **登录**: 使用 GitHub 账号登录
3. **创建项目**:
   - 点击 "Add New Project"
   - 选择你的仓库
   - 配置：
     - **Framework Preset**: Vite
     - **Root Directory**: `backend/frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
4. **配置环境变量**:
   ```
   VITE_API_BASE=https://your-backend.railway.app
   ```
5. **部署**: Vercel 会自动部署

---

## 📋 部署前检查清单

- [ ] 代码已提交到 GitHub
- [ ] 更新了 `backend/database.py` 支持 PostgreSQL
- [ ] 更新了 `backend/main.py` 支持环境变量 CORS
- [ ] 更新了 `backend/requirements.txt` 包含 `psycopg2-binary`
- [ ] 前端组件已使用 `src/config.ts` 统一配置 API_BASE
- [ ] 创建了 `.gitignore` 文件

---

## 🔧 环境变量配置

### 后端环境变量（Railway）

```
DATABASE_URL=postgresql://... (Railway 自动设置)
CORS_ORIGINS=https://your-frontend.vercel.app
DEBUG=false
```

### 前端环境变量（Vercel）

```
VITE_API_BASE=https://your-backend.railway.app
```

---

## 🐛 常见问题

### Q: CORS 错误
**解决**: 在 Railway 环境变量中设置 `CORS_ORIGINS` 为你的前端域名

### Q: 数据库连接失败
**解决**: 确保 Railway 已创建 PostgreSQL 数据库，`DATABASE_URL` 会自动设置

### Q: 前端 API 调用失败
**解决**: 检查 Vercel 环境变量 `VITE_API_BASE` 是否正确

---

## 📚 详细文档

更多部署选项和详细说明，请查看：
- [完整部署指南](docs/07_Deployment.md)

---

## ✨ 部署后验证

1. 访问后端健康检查: `https://your-backend.railway.app/health`
2. 访问前端页面: `https://your-frontend.vercel.app`
3. 测试 API 调用是否正常

---

## 💡 提示

- Railway 和 Vercel 都提供免费 tier，适合 MVP 阶段
- 两个平台都支持自动部署（Git push 触发）
- 都提供 HTTPS 和自定义域名支持

