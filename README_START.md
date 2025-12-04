# PromptOps 启动说明

## 后端启动

### 方式一：使用启动脚本（推荐）

**Windows PowerShell:**
```powershell
.\start_backend.ps1
```

**Windows CMD:**
```cmd
start_backend.bat
```

### 方式二：手动启动

**重要：必须在项目根目录 `E:\PromptOps_MVP` 下运行！**

```bash
# 1. 确保在项目根目录
cd E:\PromptOps_MVP

# 2. 安装依赖（如果还没安装）
pip install -r backend/requirements.txt

# 3. 启动后端服务
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 常见错误

#### 错误：`ModuleNotFoundError: No module named 'backend'`

**原因：** 在错误的目录下运行了命令

**解决方法：**
1. 确保在项目根目录 `E:\PromptOps_MVP` 下运行
2. 不要进入 `backend` 目录后再运行
3. 使用 `python -m uvicorn backend.main:app` 而不是 `python -m uvicorn main:app`

#### 错误：`Form data requires "python-multipart" to be installed`

**解决方法：**
```bash
pip install python-multipart
```

## 前端启动

```bash
# 1. 进入前端目录
cd backend/frontend

# 2. 安装依赖（如果还没安装）
npm install

# 3. 启动开发服务器
npm run dev
```

## 访问地址

- 后端 API: http://127.0.0.1:8000
- 后端文档: http://127.0.0.1:8000/docs
- 前端页面: http://localhost:5176 (或 Vite 显示的端口)

