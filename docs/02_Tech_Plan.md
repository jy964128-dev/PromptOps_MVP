这是一份为您转换好的标准 Markdown 技术文档。我已保留了所有的层级结构，格式化了架构图、表格，并为 TypeScript、Python、SQL、JSON 等代码添加了对应的语法高亮。

-----

# 🛠️ PromptOps v3.0 技术实施方案 (Technical Implementation Plan)

# 1\. 总体架构设计 (System Architecture)

我们将采用 "Modular Monolith" (模块化单体) 架构作为起步，以 Python 为核心生态，确保开发速度与 AI 生态的亲和力。随着业务扩展，可平滑拆分为微服务。

## 1.1 逻辑架构图

```plaintext
[用户层]    [Browser/Next.js]  [Make.com/Zapier]  [Business Apps]
                 │                │                │
                 ▼                ▼                ▼
[接入层]    ───────── API Gateway / Load Balancer ──────────
                 │                │                │
            (WebSocket)      (Webhook)       (REST API)
                 │                │                │
[应用层]    ┌──────────────── FASTAPI SERVER ────────────────┐
(Python)    │                                                │
            │  1. Prompt Engine (渲染/模板/变量注入)          │
            │  2. Flow Orchestrator (链式执行引擎 - DAG)      │
            │  3. Evaluation Worker (评测/打分)               │
            │  4. Integration Hub (Webhook/Auth)             │
            │                                                │
            └──────────────────────┬─────────────────────────┘
                                   │
[模型层]             LiteLLM Proxy (统一模型网关)
(Adaptor)            │      │        │        │
                  OpenAI  Anthropic  Gemini  LocalLLM
                                   │
[数据层]    ┌──────────────┬───────┴──────┬──────────────┐
            │ PostgreSQL   │    Redis     │   S3/MinIO   │
            │ (Metadata)   │ (Cache/Queue)│ (Datasets)   │
            │ + pgvector   │              │              │
            └──────────────┴──────────────┴──────────────┘
```

# 2\. 技术栈详细选型 (Tech Stack Specifications)

| 模块 | 技术选型 | 选型理由 |
| :--- | :--- | :--- |
| **前端框架** | Next.js 14 (App Router) | React 生态首选，SSR 保证首屏速度，便于构建复杂 B 端交互。 |
| **UI 组件库** | Shadcn/ui + Tailwind CSS | 极致的开发效率，风格现代化，易于定制。 |
| **代码编辑器** | Monaco Editor | VS Code 同款内核，只有它能完美支持 Prompt 语法高亮、Diff 对比。 |
| **状态管理** | Zustand | 轻量级，处理 Prompt Builder 的复杂嵌套 JSON 状态非常高效。 |
| **后端框架** | FastAPI (Python) | 原生异步 (Async/Await) 支持，完美适配 LLM 流式输出和高并发 API。 |
| **模型适配** | LiteLLM | Python 库，一行代码切换 100+ 模型，不仅是 Wrapper，还处理了 Error Handling。 |
| **数据库** | PostgreSQL + pgvector | 关系型数据与向量数据 (Embedding) 存放在同一个库，降低运维成本。 |
| **异步队列** | Celery + Redis | 处理批量评测、耗时较长的 Chain 执行任务。 |
| **Token 计算** | tiktoken (Py) / gpt-tokenizer (JS) | 前后端双重校验，前端用于实时预估，后端用于精确计费。 |

# 3\. 核心模块详细实现 (Key Module Implementation)

## 3.1 Prompt Studio (结构化编辑器与实时反馈)

### A. 结构化构建 (Builder Mode)

  * **数据流**： 前端维护一个 `PromptSchema` 对象。

<!-- end list -->

```typescript
interface PromptSchema {
  role: string;
  task: string;
  context: string; // 包含 {{variables}}
  constraints: string[];
  few_shot: {input: string, output: string}[];
}
```

  * **实时渲染**： 使用 Handlebars 或 Jinja2 的 JS 实现版本，在前端将上述 Object 实时拼接成 String，显示在右侧预览区。

### B. 变量自动嗅探 (Regex Watcher)

  * **实现**： 在 `useEffect` 钩子中监听 Context/Task 等输入框的变化。

<!-- end list -->

```javascript
// 前端伪代码
const pattern = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const foundVariables = new Set([...text.matchAll(pattern)].map(m => m[1]));
updateVariablePanel(foundVariables); // 自动更新侧边栏输入框
```

### C. 实时成本雷达 (Cost Radar)

  * **策略**： 纯前端计算，不请求后端。
  * **逻辑**：
    1.  加载精简版 Tokenizer (针对 `cl100k_base` 编码)。
    2.  `InputCost = countTokens(promptText) * ModelPrice.input`
    3.  `OutputCost = maxTokensParam * ModelPrice.output` (悲观估算)
    4.  监听 ModelSelector 变化，实时刷新价格。

## 3.2 Flow Orchestrator (简易链式引擎)

为了实现 Liam 建议的“Prompt Chain”，我们需要一个轻量级的执行器。

  * **执行逻辑 (Python)**:

<!-- end list -->

```python
async def execute_flow(flow_id, initial_inputs):
    steps = get_flow_steps(flow_id) # 获取步骤定义
    context = initial_inputs # 共享上下文

    for step in steps:
        # 1. 变量解析：从 context 中提取上一步的结果
        prompt_inputs = resolve_inputs(step.input_mapping, context)

        # 2. 调用 LLM
        prompt = get_prompt_version(step.prompt_ref)
        result = await litellm.acompletion(prompt, **prompt_inputs)

        # 3. 结果存回上下文
        context[f"step_{step.id}_output"] = result.content

    return context["final_output"]
```

  * **并发控制**： 即使是 MVP，对于独立的 Steps，可以使用 `asyncio.gather` 并行执行。

## 3.3 No-Code Webhook 集成 (Integration Hub)

这是打通 Make.com 的关键。

  * **动态路由设计**：
      * URL: `POST /api/webhooks/{webhook_secret}`
  * **Payload 处理 (Flexible Parser)**：
      * Make/Zapier 发过来的通常是扁平的 JSON: `{"customer_name": "Liam", "topic": "AI"}`。
      * 后端接收 Payload 后，直接将其 `dict` 作为 variables 注入到 Prompt 中。
  * **容错**： 如果 Payload 缺少 Prompt 必需的变量，返回 HTTP 400，并返回具体错误信息 `Missing variable: {{topic}}`，方便 No-Code 用户调试。

## 3.4 Evaluation Lab (自动评测)

  * **存储设计 (pgvector)**：
      * 表 `evaluation_embeddings`: 存储“标准答案”的向量。
      * 当跑测运行时，将 LLM 输出转化为向量，使用 Postgres SQL 语句 `1 - (embedding <=> expected_embedding)` 直接计算余弦相似度。
  * **LLM-as-a-Judge**：
      * 这是一个独立的后台任务。使用预置的高级 Prompt（裁判模板）将 `(UserPrompt, ModelOutput, ExpectedOutput)` 三者一同发给 GPT-4，要求其输出 JSON 格式的评分理由。

# 4\. 数据库核心 Schema 设计 (PostgreSQL)

```sql
-- Prompt 主表
CREATE TABLE prompts (
    id UUID PRIMARY KEY,
    project_id UUID,
    name VARCHAR(255),
    alias VARCHAR(100) UNIQUE -- 用于 API 调用的友好别名
);

-- 版本控制表 (核心)
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY,
    prompt_id UUID REFERENCES prompts(id),
    version_num VARCHAR(20), -- e.g., "1.0.2"
    structure_json JSONB,    -- 存储 Role, Task 等结构化数据
    compiled_template TEXT,  -- 渲染后的 Jinja2 模板
    config_json JSONB,       -- Model, Temp, Top_P
    status VARCHAR(20)       -- Draft, Published, Deprecated
);

-- 部署/环境表 (实现动态路由)
CREATE TABLE deployments (
    id UUID PRIMARY KEY,
    prompt_id UUID,
    environment VARCHAR(50), -- 'prod', 'staging'
    active_version_id UUID,  -- 当前指向的 Version
    webhook_secret VARCHAR(255) -- 用于 No-Code 调用
);

-- 流程定义表
CREATE TABLE flows (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    dag_definition JSONB -- 定义 Step 顺序和变量映射
);
```

# 5\. API 接口规范 (关键接口)

## 5.1 运行 Prompt (供 SDK 调用)

  * **Endpoint**: `POST /api/v1/run/{prompt_alias}`
  * **Headers**: `X-API-Key: sk-xxxx`
  * **Body**:

<!-- end list -->

```json
{
  "variables": {
    "user_name": "Alice",
    "query": "Reset password"
  },
  "stream": true
}
```

  * **Response**: (Server-Sent Events stream)

## 5.2 运行 Flow (供业务复杂逻辑调用)

  * **Endpoint**: `POST /api/v1/flows/{flow_id}/execute`
  * **Body**: `{"inputs": {...}}`

# 6\. 基础设施与安全性 (Infra & Security)

  * **密钥管理 (Vault Strategy)**:
      * 用户的 OpenAI/Anthropic API Key 绝不明文存储。
      * 使用 AES-256 加密存入数据库，或者集成 HashiCorp Vault / AWS Secrets Manager。
      * 后端在运行时解密，注入到 LiteLLM 内存中。
  * **PII 防护 (Middleware)**:
      * 在 FastAPI 中间件层集成 Microsoft Presidio (开源 PII 识别库)。
      * 在发送给 LLM 前，自动将 Email/Phone 替换为 `<EMAIL>`, `<PHONE>`。
  * **高并发与限流**:
      * 使用 Redis 实现 Token Bucket 算法，对每个 API Key 进行 RPM (Requests Per Minute) 限制，防止被刷爆。

# 7\. 敏捷开发冲刺计划 (Development Roadmap)

基于 2周一个 Sprint 的节奏：

  * **Sprint 1: The Foundation (基础)**
      * 搭建 FastAPI + Next.js 骨架。
      * 实现 Prompt CRUD 和 Version Control (DB Schema)。
      * 完成 Code Mode 编辑器。
  * **Sprint 2: The Builder (结构化与体验)**
      * 开发 Builder Mode (Form -\> JSON)。
      * 实现变量自动嗅探和前端成本计算。
      * 集成 LiteLLM，跑通多模型对话。
  * **Sprint 3: The Integrator (连接)**
      * 实现 API Gateway 逻辑 (Alias -\> Version)。
      * 开发 Webhook Endpoint，并在 Make.com 上进行联调测试。
      * 实现 API Key 鉴权体系。
  * **Sprint 4: The Orchestrator (链与评测)**
      * 开发 Flow Engine (线性链)。
      * 搭建 Celery Worker，实现批量跑测。
      * 上线 LLM-as-a-Judge 打分功能。

