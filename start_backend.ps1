# 启动 PromptOps 后端服务
# 确保在项目根目录下运行此脚本

Write-Host "正在启动 PromptOps 后端服务..." -ForegroundColor Green
Write-Host ""
Write-Host "提示：请确保已安装所有依赖（运行: pip install -r backend/requirements.txt）" -ForegroundColor Yellow
Write-Host ""

# 切换到脚本所在目录
Set-Location $PSScriptRoot

# 启动后端服务
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

