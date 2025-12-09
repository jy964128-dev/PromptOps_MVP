# 🚀 PromptOps 逐步部署指南

## 📋 部署前准备

✅ 已完成的准备工作：
- [x] 代码已推送到 GitHub
- [x] 数据库配置支持 PostgreSQL
- [x] CORS 配置支持环境变量
- [x] 前端 API 配置支持环境变量
- [x] 创建了部署配置文件

---

## 第一步：部署后端到 Railway

### 1.1 访问 Railway 并登录

1. 打开浏览器，访问：**https://railway.app**
2. 点击右上角 **"Login"** 或 **"Start a New Project"**
3. 选择 **"Login with GitHub"**
4. 授权 Railway 访问你的 GitHub 账号（jy964128-dev）

### 1.2 创建新项目

1. 登录后，点击 **"New Project"** 按钮
2. 选择 **"Deploy from GitHub repo"**
3. 在仓库列表中找到并选择 **`PromptOps_MVP`**
4. Railway 会自动开始检测项目类型

### 1.3 添加 PostgreSQL 数据库

1. 在项目页面，点击 **"+ New"** 按钮
2. 选择 **"Database"** → **"Add PostgreSQL"**
3. Railway 会自动创建 PostgreSQL 数据库
4. ⚠️ **重要**：数据库创建后，Railway 会自动设置 `DATABASE_URL` 环境变量，无需手动配置

### 1.4 配置环境变量（可选，稍后配置）

1. 在项目页面，点击服务名称（通常是 "PromptOps_MVP"）
2. 进入 **"Variables"** 标签页
3. 暂时**不需要**添加任何变量（CORS 稍后配置）

### 1.5 等待部署完成

1. Railway 会自动检测到 Python 项目
2. 自动运行 `pip install -r backend/requirements.txt`
3. 自动运行启动命令
4. 等待部署完成（通常 2-5 分钟）

### 1.6 获取后端 URL

1. 部署完成后，在服务页面点击 **"Settings"** 标签
2. 找到 **"Domains"** 部分
3. 点击 **"Generate Domain"** 生成一个公共域名
4. 复制这个 URL，例如：`https://promptops-backend-production.up.railway.app`
5. ⚠️ **保存这个 URL**，稍后需要用到

### 1.7 验证后端部署

1. 在浏览器中访问：`你的后端URL/health`
2. 应该看到：`{"status": "healthy"}`
3. 如果看到这个响应，说明后端部署成功！✅

---

## 第二步：部署前端到 Vercel

### 2.1 访问 Vercel 并登录

1. 打开浏览器，访问：**https://vercel.com**
2. 点击右上角 **"Sign Up"** 或 **"Log In"**
3. 选择 **"Continue with GitHub"**
4. 授权 Vercel 访问你的 GitHub 账号

### 2.2 创建新项目

1. 登录后，点击 **"Add New..."** → **"Project"**
2. 在仓库列表中找到并选择 **`PromptOps_MVP`**
3. 点击 **"Import"**

### 2.3 配置项目设置

在项目配置页面，设置以下内容：

#### Framework Preset
- 选择：**Vite**（Vercel 通常会自动检测）

#### Root Directory
- 点击 **"Edit"**，设置为：`backend/frontend`
- ⚠️ **重要**：必须设置这个，否则 Vercel 找不到前端代码

#### Build and Output Settings
- **Build Command**: `npm run build`（通常自动填充）
- **Output Directory**: `dist`（通常自动填充）
- **Install Command**: `npm install`（通常自动填充）

### 2.4 配置环境变量

在 **"Environment Variables"** 部分：

1. 点击 **"Add"** 添加新变量
2. 变量名：`VITE_API_BASE`
3. 变量值：**粘贴你在第一步获取的后端 URL**
   - 例如：`https://promptops-backend-production.up.railway.app`
4. 点击 **"Save"**

### 2.5 部署

1. 确认所有配置正确
2. 点击 **"Deploy"** 按钮
3. 等待构建和部署完成（通常 2-3 分钟）

### 2.6 获取前端 URL

1. 部署完成后，Vercel 会显示部署成功页面
2. 你会看到一个 URL，例如：`https://promptops-mvp.vercel.app`
3. ⚠️ **保存这个 URL**，下一步需要用到

### 2.7 验证前端部署

1. 在浏览器中访问你的前端 URL
2. 应该能看到 PromptOps 的界面
3. ⚠️ 如果看到 API 调用错误，这是正常的，因为还需要配置 CORS

---

## 第三步：配置后端 CORS

### 3.1 回到 Railway

1. 回到 Railway 项目页面
2. 点击你的服务（后端服务）
3. 进入 **"Variables"** 标签页

### 3.2 添加 CORS 环境变量

1. 点击 **"+ New Variable"**
2. 变量名：`CORS_ORIGINS`
3. 变量值：**粘贴你在第二步获取的前端 URL**
   - 例如：`https://promptops-mvp.vercel.app`
   - ⚠️ **注意**：不要包含末尾的斜杠 `/`
4. 点击 **"Add"**

### 3.3 等待重新部署

1. Railway 检测到环境变量变化后，会自动重新部署
2. 等待 1-2 分钟，直到部署完成

---

## 第四步：最终验证

### 4.1 验证后端

访问：`你的后端URL/health`
- ✅ 应该返回：`{"status": "healthy"}`

访问：`你的后端URL/`
- ✅ 应该返回 API 信息

### 4.2 验证前端

1. 访问你的前端 URL
2. ✅ 应该能看到完整的界面
3. ✅ 尝试创建一个新提示词
4. ✅ 检查数据大屏是否正常显示
5. ✅ 检查浏览器控制台（F12），确认没有 CORS 错误

### 4.3 测试完整流程

1. ✅ 创建新项目
2. ✅ 创建新提示词
3. ✅ 编辑提示词
4. ✅ 查看数据大屏
5. ✅ 测试导入/导出功能

---

## 🎉 部署完成！

如果所有步骤都成功，恭喜你！PromptOps 已经成功部署到云平台了！

---

## 🐛 常见问题排查

### 问题 1: Railway 部署失败

**症状**：部署过程中出现错误

**排查步骤**：
1. 检查 Railway 的部署日志
2. 确认 `requirements.txt` 文件存在且格式正确
3. 确认 `Procfile` 存在（Railway 会自动使用）
4. 检查是否有 Python 版本问题

**解决方案**：
- 在 Railway 项目设置中，可以指定 Python 版本
- 检查 `backend/requirements.txt` 是否包含所有依赖

### 问题 2: Vercel 构建失败

**症状**：前端构建失败

**排查步骤**：
1. 检查 Vercel 的构建日志
2. 确认 `Root Directory` 设置为 `backend/frontend`
3. 确认 `package.json` 存在
4. 检查是否有依赖安装问题

**解决方案**：
- 确认 `backend/frontend/package.json` 存在
- 检查 Node.js 版本兼容性

### 问题 3: CORS 错误

**症状**：前端可以访问，但 API 调用失败，浏览器控制台显示 CORS 错误

**排查步骤**：
1. 检查 Railway 的 `CORS_ORIGINS` 环境变量
2. 确认前端 URL 正确（包含 `https://`，不包含末尾斜杠）
3. 检查后端日志

**解决方案**：
- 更新 `CORS_ORIGINS` 为正确的前端 URL
- 如果使用多个域名，用逗号分隔：`https://domain1.com,https://domain2.com`
- Railway 会自动重新部署

### 问题 4: 数据库连接失败

**症状**：后端启动失败，日志显示数据库连接错误

**排查步骤**：
1. 检查 Railway PostgreSQL 服务是否正常运行
2. 确认 `DATABASE_URL` 环境变量已自动设置
3. 检查数据库服务状态

**解决方案**：
- Railway 会自动设置 `DATABASE_URL`，无需手动配置
- 如果数据库服务停止，在 Railway 中重启它
- 检查数据库是否已创建（Railway 会自动创建）

### 问题 5: 前端 API 调用失败

**症状**：前端页面加载，但所有 API 调用都失败

**排查步骤**：
1. 检查 Vercel 的 `VITE_API_BASE` 环境变量
2. 确认后端 URL 正确且可访问
3. 检查浏览器控制台的网络请求

**解决方案**：
- 更新 `VITE_API_BASE` 为正确的后端 URL
- 确认后端 URL 可以访问（在浏览器中打开 `/health` 端点）
- 重新部署前端（Vercel 会自动检测环境变量变化）

---

## 📞 需要帮助？

如果遇到其他问题：
1. 查看 Railway 和 Vercel 的部署日志
2. 检查浏览器控制台的错误信息
3. 参考 [完整部署文档](docs/07_Deployment.md)

---

## 🎯 下一步

部署成功后，你可以：
- ✅ 分享应用链接给团队成员
- ✅ 继续开发新功能
- ✅ 配置自定义域名
- ✅ 设置监控和日志











