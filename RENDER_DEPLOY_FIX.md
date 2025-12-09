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

---

## 🔴 问题 5: PostgreSQL 连接失败 - "could not translate host name"

### 错误现象
```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) 
could not translate host name "dpg-xxx-a" to address: Name or service not known
```

### 原因分析
Render 的 PostgreSQL 数据库有两种连接方式：
1. **Internal Database URL** - 用于同一网络内的服务连接
2. **External Connection String** - 用于外部连接

如果主机名看起来不完整（例如只有 `dpg-xxx-a`），可能是：
- 使用了错误的 DATABASE_URL 格式
- Render 自动同步的 DATABASE_URL 格式不正确
- 需要使用 External Connection String 而不是 Internal URL

### 修复方案

#### 方案 1: 检查并使用正确的 DATABASE_URL

1. **在 Render Dashboard 中**：
   - 进入你的 **PostgreSQL 数据库服务**页面
   - 找到 **"Connections"** 或 **"Info"** 标签
   - 查看 **"Internal Database URL"** 和 **"External Connection String"**

2. **选择正确的连接字符串**：
   - 如果 Web Service 和 PostgreSQL 在**同一个 Render 项目**中，使用 **Internal Database URL**
   - 如果它们在不同的项目中，或需要外部访问，使用 **External Connection String**

3. **更新环境变量**：
   - 在 Web Service 的 **"Environment"** 标签中
   - 找到 `DATABASE_URL` 环境变量
   - 点击 **"Edit"** 或 **"Add"**
   - 粘贴正确的连接字符串
   - 格式应该是：`postgresql://user:password@hostname:port/database`
   - 确保主机名是完整的（例如：`dpg-xxx-a.singapore-postgres.render.com` 或类似格式）

#### 方案 2: 手动构建连接字符串

如果 Render 自动同步的 DATABASE_URL 不正确，可以手动构建：

1. **获取数据库信息**：
   - 在 PostgreSQL 服务页面找到：
     - Host（主机名）
     - Port（端口，通常是 5432）
     - Database（数据库名）
     - User（用户名）
     - Password（密码）

2. **构建连接字符串**：
   ```
   postgresql://用户名:密码@主机名:端口/数据库名
   ```
   
   例如：
   ```
   postgresql://promptops_user:your_password@dpg-xxx-a.singapore-postgres.render.com:5432/promptops_db
   ```

3. **设置环境变量**：
   - 在 Web Service 的 Environment 标签中
   - 添加或更新 `DATABASE_URL` 环境变量
   - 粘贴构建的连接字符串

#### 方案 3: 使用 Render 的环境变量引用

如果 PostgreSQL 和 Web Service 在同一个项目中：

1. **在 Web Service 的 Environment 标签中**：
   - 点击 **"Add Environment Variable"**
   - Key: `DATABASE_URL`
   - Value: 从 PostgreSQL 服务页面复制 **Internal Database URL**
   - 或者使用 Render 的变量引用（如果支持）

2. **确保格式正确**：
   - 连接字符串应该以 `postgresql://` 或 `postgres://` 开头
   - 主机名应该是完整的域名（包含 `.render.com` 或类似后缀）

### 验证修复

1. **重新部署服务**：
   - 在 Web Service 页面点击 **"Manual Deploy"**
   - 选择 **"Deploy latest commit"**

2. **查看日志**：
   - 在 **"Logs"** 标签查看部署日志
   - 应该看到类似信息：
     ```
     数据库连接信息: postgresql+psycopg2://user@****/database
     主机名: dpg-xxx-a.render.com, 端口: 5432
     数据库初始化完成
     ```

3. **测试连接**：
   - 访问 `https://your-service.onrender.com/health`
   - 应该返回 `{"status": "healthy"}`

### 常见问题

**Q: 如何知道应该使用 Internal 还是 External URL？**
- 如果 Web Service 和 PostgreSQL 在**同一个 Render 项目**中，使用 **Internal Database URL**
- 如果它们在不同的项目中，使用 **External Connection String**

**Q: 主机名格式应该是怎样的？**
- Internal URL: `dpg-xxx-a.render.com` 或 `dpg-xxx-a.region-postgres.render.com`
- External URL: 通常是完整的域名，格式类似

**Q: 连接字符串中需要包含端口吗？**
- 如果端口是默认的 5432，可以省略
- 如果端口不是 5432，必须包含：`hostname:port`

### 调试技巧

如果仍然失败，可以在代码中添加调试信息（已添加）：

1. **查看启动日志**：
   - 在 Render Logs 中查找数据库连接信息
   - 检查主机名、端口、数据库名是否正确

2. **检查环境变量**：
   - 在 Web Service Settings → Environment 中
   - 确认 `DATABASE_URL` 已正确设置
   - 注意：Render 可能会自动同步，但有时需要手动设置








