@echo off
REM 启动 PromptOps 后端服务
REM 确保在项目根目录下运行此脚本

echo 正在启动 PromptOps 后端服务...
echo.
echo 提示：请确保已安装所有依赖（运行: pip install -r backend/requirements.txt）
echo.

cd /d %~dp0
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

pause

