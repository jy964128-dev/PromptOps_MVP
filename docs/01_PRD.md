这是一个为您转换好的标准 Markdown 文档。我已经按照您的要求，保持了标题层级，格式化了列表和表格，并将代码、API 路径及 JSON 数据放入了代码块中。

-----

# 项目名称：PromptOps 智库 (Enterprise Prompt Lifecycle Management System)

  - **版本号**： v3.0
  - **文档状态**： 待开发评审
  - **最后更新**： 2025-12-01

# 1\. 项目背景与目标

## 1.1 背景

企业内部大模型应用开发面临“提示词非标准化”、“效果难以量化”、“模型绑定风险”以及“与业务流集成困难”四大痛点。

## 1.2 目标

构建一个集结构化编写、多模型调试、自动化评测、链式编排、无代码发布于一体的协作平台，将 Prompt 从“文本处理”升级为“工程化资产管理”。

## 1.3 核心理念

  * **Structured (结构化)**: 基于组件的 Prompt 构建。
  * **Model-Agnostic (模型无关)**: 统一网关，随时切换底层模型。
  * **Data-Driven (数据驱动)**: 基于测试集和自动评分进行优化。
  * **Integration-First (集成优先)**: API 与 No-Code Webhook 并重。

# 2\. 用户角色 (User Personas)

| 角色 | 核心职责 | 关键痛点解决 |
| :--- | :--- | :--- |
| **Prompt Engineer (PE)** | 编写、调试、优化 Prompt | 告别手动复制粘贴，实现所见即所得的变量调试与版本管理。 |
| **AI 开发者 (Dev)** | 集成 API、维护系统 | 通过 SDK/API 调用稳定版本，无需关心 Prompt 具体内容变更。 |
| **自动化专家 (No-Code)** | 搭建 Make/Zapier 工作流 | 直接获取 Webhook 地址，无需写代码即可调用复杂 Prompt。 |
| **业务/产品经理 (PM)** | 验收效果、监控成本 | 实时查看 Token 成本预估，基于数据报告验收上线。 |

# 3\. 功能需求详情 (Functional Requirements)

## 3.1 模块一：Prompt Studio (智能创作工坊)

**目标**： 提供 IDE 级别的编写体验，支持结构化构建与实时反馈。

### F1.1 双模式编辑器

  * **Code Mode**: 纯 Markdown/Jinja2 编辑器，支持语法高亮。
  * **Builder Mode (结构化)**: 将 Prompt 拆解为 Form 表单：
      * Role (角色), Task (任务), Context (背景), Constraints (约束), Format (输出格式), Few-Shot Examples (示例)。
      * 系统后台自动根据 JSON Schema 拼装最终 Prompt。

### F1.2 智能变量系统 (Smart Variable System)

  * **自动嗅探 (Auto-Detection)**: 监听编辑器输入，实时正则匹配 `{{variable}}` 语法，自动在侧边栏生成对应测试输入框。
  * **默认值管理**: 允许为变量设置 Default Value，方便快速调试。

### F1.3 实时成本雷达 (Cost Radar)

根据当前 Prompt 字符数 + 预估 Max Tokens + 选定模型费率，实时显示：

  * 单次运行预估成本 (e.g., $0.003)。
  * 不同模型成本对比 (e.g., "切换至 GPT-4o-mini 可节省 95%")。

### F1.4 AI Copilot (提示词协理)

  * **Magic Enhance**: 输入简短意图，AI 自动扩写为结构化 Prompt。
  * **Compressor**: 一键精简冗余词汇，降低 Token 消耗。

### F1.5 多模型竞技场 (Arena)

支持同时勾选多个模型 (OpenAI, Claude, Gemini)，分屏流式 (Streaming) 展示输出结果，便于横向对比。

## 3.2 模块二：Prompt Registry (资产仓库)

**目标**： 实现 Prompt 的版本控制与全生命周期管理。

### F2.1 版本管理 (Versioning)

  * 语义化版本号 (v1.0, v1.1)。
  * 支持版本回滚与 Diff 对比 (高亮显示修改内容)。

### F2.2 状态流转

`Draft (草稿)` -\> `Staging (测试中)` -\> `Production (已上线)` -\> `Deprecated (已废弃)`。

### F2.3 标签与元数据

支持按项目、业务线、功能标签 (`#RAG`, `#Summary`) 进行分类检索。

## 3.3 模块三：Evaluation Lab (评测实验室)

**目标**： 建立客观的质量评价体系。

### F3.1 数据集管理

支持上传 CSV/JSON 测试集 (Input Variables + Expected Output)。

### F3.2 批量跑测 (Batch Run)

后台异步队列执行批量测试，前端展示进度条。

### F3.3 自动化评分 (Auto-Grading)

  * **结构依从性 (Structure Check)**: 检查输出是否符合 JSON/Markdown 格式要求。
  * **语义相似度 (Similarity)**: 基于 Embedding 计算输出与标准答案的距离。
  * **LLM裁判 (LLM-as-a-Judge)**: 调用高智商模型 (GPT-4) 根据维度 (准确性、语气、安全性) 打分。

## 3.4 模块四：Flow Orchestrator (流程编排) [MVP]

**目标**： 支持基础的 Prompt 串联逻辑。

### F4.1 线性链构建 (Linear Chain)

  * 支持定义 Step 1 -\> Step 2 -\> Step 3。
  * **变量传递**: Step 2 的输入可以直接引用 Step 1 的输出 `{{step_1.output}}`。

### F4.2 链式调试

单次点击运行整个 Flow，分步展示中间结果。

## 3.5 模块五：Deployment & Integration (发布与集成)

**目标**： 无缝接入业务系统与无代码平台。

### F5.1 统一 API 网关

  * 提供 Restful API: `POST /api/run/{prompt_alias}`。
  * 支持动态路由: 修改 Alias 指向的版本 ID (v1.0 -\> v1.1)，业务侧无需改代码即可生效。

### F5.2 集成中心 (Integration Hub)

  * **Webhook Generator**: 为每个发布的 Prompt 生成唯一的 Webhook URL。
  * **Make/Zapier Blueprints**: 提供一键复制的 JSON 配置，支持 No-Code 平台快速接入。
  * **Python/Node.js SDK**: 提供官方客户端库。

# 4\. 技术架构概要 (Technical Architecture)

  * **前端**: Next.js (React) + Zustand (状态管理) + Monaco Editor (编辑器内核) + Tailwind CSS。
  * **后端**: FastAPI (Python, Async IO) + Celery (异步任务)。
  * **模型层**: LiteLLM (统一接口封装，适配 OpenAI/Azure/Vertex/Anthropic)。
  * **数据库**:
      * PostgreSQL (元数据 & 业务数据)。
      * pgvector (向量存储，用于评测相似度)。
      * Redis (缓存 & 消息队列)。
  * **流程引擎**: 自研轻量级 DAG 执行器 (针对 F4.1 线性链)。

# 5\. 非功能性需求 (NFR)

## N5.1 安全性

  * API Key 加密存储 (AES-256)。
  * PII 敏感信息过滤 (在发送给 LLM 前自动掩码手机号/邮箱)。

## N5.2 性能

  * 网关额外延迟 \< 50ms。
  * 支持流式响应 (Server-Sent Events) 透传。

## N5.3 可观测性

  * 记录所有 API 调用的 Input/Output/Tokens/Latency/Cost。

# 6\. 数据统计与监控 (Analytics)

  * **Cost Dashboard**: 按项目、按用户统计 Token 消耗金额。
  * **Usage Trends**: API 调用次数趋势图。
  * **Quality Monitor**: 线上用户反馈 (Thumbs up/down) 收集。

# 7\. 实施路线图 (Roadmap)

| 阶段 | 周期 | 核心交付物 | 关键价值 |
| :--- | :--- | :--- | :--- |
| **Phase 1: MVP Core** | Sprint 1-2 | Prompt Studio (Code/Builder模式), 变量自动嗅探, 实时成本预估, 基础 CRUD | 提供极致的单点编写体验，建立成本意识。 |
| **Phase 2: Registry & Gateway** | Sprint 3-4 | 版本控制, LiteLLM 多模型接入, API 网关, SDK 发布 | 实现 Prompt 资产化，业务系统可调用。 |
| **Phase 3: Integration** | Sprint 5 | Webhook 生成, Make.com 集成支持, 动态路由 | 打通 No-Code 场景，支持热更新。 |
| **Phase 4: Automation** | Sprint 6-7 | 批量评测, LLM 自动打分, 简易线性 Flow | 建立质量闭环，支持复杂任务链。 |

# 8\. 附录：核心数据结构示例 (JSON Schema)

```json
// Prompt Structure Object
{
  "id": "prompt_summary_001",
  "version": "1.2.0",
  "config": {
    "model": "gpt-4-turbo",
    "temperature": 0.7
  },
  "components": {
    "role": "Financial Analyst",
    "task": "Summarize the earnings call transcript",
    "constraints": ["Keep it under 200 words", "Use bullet points"],
    "format": "Markdown",
    "context": "{{transcript_text}}"
  },
  "variables": ["transcript_text"],
  "chain_logic": null // Or specific next_step definitions for Flows
}
```