## PromptOps 使用说明书（Introduction）

> 版本：MVP 开发阶段  
> 目标读者：内部研发、产品与测试同学

---

## 一、项目概览

- **项目名称**：PromptOps – Prompt 生命周期管理系统  
- **技术栈**：
  - **后端**：Python 3.11+、FastAPI、SQLAlchemy、SQLite（开发环境）
  - **前端**：React + TypeScript + Vite + Tailwind CSS
- **主要功能（MVP 阶段）**：
  - 提示词（Prompt）元数据与版本管理
  - 提示词列表浏览与搜索
  - 后端 API 健康检查与基础数据表初始化

---

## 二、目录结构（简要）

```text
E:\PromptOps_MVP
├─ backend              # 后端代码
│  ├─ main.py           # FastAPI 入口
│  ├─ database.py       # 数据库配置（SQLite）
│  ├─ models.py         # SQLAlchemy 模型
│  └─ frontend          # 前端工程（Vite）
│     ├─ src
│     │  ├─ components
│     │  │  └─ PromptList.tsx   # 提示词列表页面
│     │  ├─ App.tsx
│     │  └─ index.css
│     ├─ tailwind.config.js
│     └─ postcss.config.js
└─ docs                 # 文档
   ├─ 01_PRD.md
   ├─ 02_Tech_Plan.md
   ├─ 04_MVP_Specs.md
   ├─ 05_UI_UX.md
   └─ inroduction.md    # 本说明书
```

---

## 三、环境准备

- **操作系统**：Windows 10+
- **必须工具**：
  - Python 3.11+（建议通过 Scoop 安装）
  - Node.js（LTS 版本，已包含 npm）
  - Git（可选，用于版本管理）

> 建议为 Python 使用本地虚拟环境（`venv`），但当前示例已直接用系统 Python + `pip` 安装依赖。

---

## 四、后端使用说明（FastAPI + SQLite）

### 4.1 安装后端依赖

在项目根目录执行：

```powershell
cd E:\PromptOps_MVP
python -m pip install -r backend/requirements.txt
```

如缺少 `uvicorn` 或 `fastapi`，可以补充安装：

```powershell
python -m pip install uvicorn fastapi sqlalchemy
```

### 4.2 启动后端服务

在项目根目录执行：

```powershell
cd E:\PromptOps_MVP
python -m uvicorn backend.main:app --reload
```

看到如下日志说明启动成功：

```text
Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
Application startup complete.
数据库初始化完成
```

> **注意**：  
> - 这个终端窗口需要保持运行，不要关闭。  
> - 若 8000 端口被占用，可改用 `--port 8001` 等。

### 4.3 基础接口验证

- 健康检查根路径：

```text
GET http://127.0.0.1:8000/
```

预期返回：

```json
{
  "message": "PromptOps API",
  "version": "1.0.0",
  "status": "running"
}
```

- 健康检查专用接口：

```text
GET http://127.0.0.1:8000/health
```

预期返回：

```json
{ "status": "healthy" }
```

### 4.4 数据库说明

- 当前使用 **SQLite**，数据库文件为：`promptops.db`（生成在项目根目录）
- 初始化时会自动创建以下表（简要）：
  - `projects`：项目/工作区
  - `prompts`：提示词元数据
  - `prompt_versions`：提示词版本信息
  - `user_api_keys`：用户 API Key 映射（MVP 阶段）

> 正式环境会迁移到 PostgreSQL + pgvector，详见 `docs/02_Tech_Plan.md` 与 `docs/06_DB_Init.md`。

---

## 五、前端使用说明（Vite + React + Tailwind）

### 5.1 安装前端依赖

```powershell
cd E:\PromptOps_MVP\backend\frontend
npm install
```

### 5.2 启动前端开发服务器

```powershell
cd E:\PromptOps_MVP\backend\frontend
npm run dev
```

终端中会输出类似：

```text
Local:   http://localhost:517x/
```

> 端口号可能是 5173 / 5174 / 5175 / 5176 等，**以终端实际输出为准**。

在浏览器中访问对应地址（例如 `http://localhost:5176/`），即可看到 **提示词列表页面**。

---

## 六、当前已实现的前端页面

- **提示词列表页**（`PromptList.tsx`）
  - 顶部标题区：展示「提示词库」及简要说明。
  - 搜索栏：支持根据名称、描述、别名模糊匹配。
  - 列表区域：
    - 卡片式布局（响应式：手机 1 列、平板 2 列、桌面 3 列）
    - 展示：名称、描述、版本号、项目名、最近更新时间、slug
  - 「新建提示词」按钮：
    - 目前为占位功能，会在控制台输出日志，后续接入路由/创建流程。
  - 空状态提示：
    - 无数据或搜索无结果时展示友好提示和引导。

> 视觉风格参考 Vercel / Linear / Shadcn：黑白灰为主、简洁现代、轻量阴影和圆角。

---

## 七、常见问题（FAQ）

- **Q1：访问后端接口提示 `ERR_CONNECTION_REFUSED`？**  
  - 请确认后端终端窗口中 Uvicorn 仍在运行；若已关闭，请重新执行启动命令。

- **Q2：访问前端 `localhost:517x` 提示拒绝连接？**  
  - 说明 Vite 没在跑。请在 `backend/frontend` 目录重新执行 `npm run dev`。

- **Q3：端口变来变去怎么办？**  
  - Vite 会在端口被占用时自动 +1，始终以终端输出的 `Local: http://localhost:517x/` 为准即可。

---

## 八、后续扩展方向（Roadmap 简述）

> 详细 Roadmap 见 `docs/04_MVP_Specs.md` 与 `docs/02_Tech_Plan.md`。

- 接入 LiteLLM，打通多模型调用（gpt-4o / Claude 等）。
- 实现 Prompt 详情编辑页（Builder Mode + Code Mode）。
- 支持 Prompt 执行与 Flow 执行的后端 API。
- 引入 Evaluation（自动评测）与 Webhook 集成。





