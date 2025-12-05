# Render 部署问题修复指南

## 🔍 常见部署失败原因及修复

### 问题 1: Build Command 路径错误

**错误现象**: 找不到 `requirements.txt`

**修复方案**:
在 Render Web Service Settings 中，设置：

**Build Command**:
```
pip install -r backend/requirements.txt
```

**注意**: 不需要 `cd backend`，因为 Render 从项目根目录开始执行。

---

### 问题 2: Start Command 路径错误

**错误现象**: 找不到 `main:app` 模块

**修复方案**:
在 Render Web Service Settings 中，设置：

**Start Command**:
```
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

### 问题 3: Python 版本不兼容

**错误现象**: 依赖安装失败，版本冲突

**修复方案**:
1. 在 Render Settings 中，找到 "Python Version"
2. 设置为 `3.11` 或 `3.10`
3. 或者创建 `backend/runtime.txt` 文件（已创建）

---

### 问题 4: 缺少系统依赖

**错误现象**: `psycopg2-binary` 安装失败

**修复方案**:
`psycopg2-binary` 应该可以正常安装，如果失败，可能需要：
1. 检查 Python 版本（需要 3.8+）
2. 确保使用 `psycopg2-binary` 而不是 `psycopg2`

---

## ✅ 正确的 Render 配置

### 在 Render Web Service Settings 中：

**Name**: `promptops-backend`

**Environment**: `Python 3`

**Region**: 选择离你最近的区域

**Branch**: `main`

**Root Directory**: 留空（或设置为 `.`）

**Build Command**:
```
pip install -r backend/requirements.txt
```

**Start Command**:
```
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Python Version**: `3.11`（如果有这个选项）

---

## 🔧 完整修复步骤

### 步骤 1: 更新 Render 配置

1. 在 Render Web Service 页面，点击 "Settings"
2. 按照上面的配置更新所有设置
3. 保存更改

### 步骤 2: 检查环境变量

1. 在 "Environment" 标签
2. 确保 `DATABASE_URL` 已设置（从 PostgreSQL 服务自动同步）
3. 暂时不需要设置 `CORS_ORIGINS`（稍后配置）

### 步骤 3: 手动触发部署

1. 在 Web Service 页面，找到 "Manual Deploy" 按钮
2. 点击 "Deploy latest commit"
3. 等待部署完成

### 步骤 4: 查看部署日志

1. 在 "Logs" 标签查看实时日志
2. 如果失败，查看具体错误信息

---

## 🐛 如果仍然失败

### 查看详细错误信息

1. 在 Render Web Service 页面
2. 点击 "Events" 标签
3. 点击失败的部署事件
4. 查看详细错误信息

### 常见错误及解决方案

#### 错误: "ModuleNotFoundError: No module named 'backend'"

**原因**: Python 路径问题

**解决**: 确保 Start Command 是：
```
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### 错误: "Could not find a version that satisfies the requirement"

**原因**: 依赖版本问题或 Python 版本不兼容

**解决**: 
1. 检查 Python 版本（设置为 3.11）
2. 检查 `requirements.txt` 中的版本号

#### 错误: "Command failed with exit code 1"

**原因**: 构建或启动命令执行失败

**解决**: 
1. 检查 Build Command 和 Start Command 是否正确
2. 查看 Logs 获取详细错误信息

---

## 📝 检查清单

部署前确认：

- [ ] Build Command: `pip install -r backend/requirements.txt`
- [ ] Start Command: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Python Version: `3.11` 或 `3.10`
- [ ] Root Directory: 留空
- [ ] Branch: `main`
- [ ] DATABASE_URL 环境变量已设置

---

## 💡 提示

如果使用 `render.yaml` 文件：
- Render 会自动读取 `render.yaml` 配置
- 但手动设置的 Settings 会覆盖 `render.yaml`
- 建议先使用手动设置，确认部署成功后再使用 `render.yaml`

