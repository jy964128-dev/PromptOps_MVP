# API 配置检查指南

## 如何检查 API_BASE 配置

### 方法 1: 查看浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 "Console" 标签
3. 刷新页面
4. 查看控制台输出，你会看到：
   ```
   🔧 API 配置信息:
     - API_BASE: http://127.0.0.1:8000
     - VITE_API_BASE (环境变量): (未设置)
     - 当前环境: development
   ✅ API 连接成功: ...
   ```

### 方法 2: 检查环境变量

#### 开发环境
在 `backend/frontend` 目录下创建 `.env` 文件：
```bash
VITE_API_BASE=http://127.0.0.1:8000
```

#### 生产环境
在部署平台（如 Vercel）设置环境变量：
```
VITE_API_BASE=https://your-backend-url.com
```

### 方法 3: 手动测试 API

在浏览器控制台运行：
```javascript
// 测试健康检查端点
fetch('http://127.0.0.1:8000/health')
  .then(res => res.json())
  .then(data => console.log('✅ API 正常:', data))
  .catch(err => console.error('❌ API 错误:', err));
```

### 方法 4: 检查后端服务

1. 确保后端服务正在运行：
   ```bash
   cd backend
   python -m uvicorn main:app --reload
   ```

2. 访问后端健康检查：
   - 浏览器访问: http://127.0.0.1:8000/health
   - 应该返回: `{"status":"healthy"}`

## 常见问题

### 问题 1: "Failed to fetch"
**原因**: 后端服务未运行或 API_BASE 配置错误
**解决**: 
1. 检查后端服务是否运行
2. 检查 API_BASE 配置是否正确
3. 查看浏览器控制台的详细错误信息

### 问题 2: CORS 错误
**原因**: 后端 CORS 配置不允许前端域名
**解决**: 在 `backend/main.py` 中配置 CORS_ORIGINS 环境变量

### 问题 3: 404 Not Found
**原因**: API 路由不存在或路径错误
**解决**: 检查后端路由是否正确注册

## 调试技巧

1. **查看网络请求**:
   - 打开浏览器开发者工具
   - 切换到 "Network" 标签
   - 查看失败的请求，检查 URL 和响应

2. **查看控制台日志**:
   - 所有 API 请求都会在控制台输出 URL
   - 错误信息会包含详细的调试信息

3. **测试 API 端点**:
   - 使用 Postman 或 curl 直接测试后端 API
   - 确认后端服务正常工作







