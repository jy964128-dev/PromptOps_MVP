这是为您转换好的标准 Markdown 格式文档。

-----

# 数据库初始化 SQL 脚本 (For Backend)

  * **技术栈**： PostgreSQL 15+
  * **说明**： 此脚本包含核心表结构，采用了 JSONB 存储结构化 Prompt，为未来扩展留足空间。

<!-- end list -->

```sql
-- 1. 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- 用于生成 UUID
CREATE EXTENSION IF NOT EXISTS "vector";    -- 预留给 Evaluation 模块 (pgvector)

-- 2. 项目/工作区表 (Projects)
-- 用于简单的文件夹分类管理
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Prompt 主表 (Prompts)
-- 存储 Prompt 的元数据，不包含具体内容（内容在 versions 表）
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE, -- 用于 API 调用的别名 (e.g., "resume-parser")
    description TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：加速按项目查询
CREATE INDEX idx_prompts_project_id ON prompts(project_id);


-- 4. Prompt 版本表 (Prompt Versions) - 核心资产表
-- 每一次保存都会生成一个新 Version，或者更新 Draft Version
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    
    -- 版本号管理
    version_num VARCHAR(50), -- e.g., "1.0.0", "Draft"
    is_published BOOLEAN DEFAULT FALSE,
    
    -- [核心设计] 结构化数据 (Builder Mode 数据源)
    -- 存储: { "role": "...", "task": "...", "context": "...", "constraints": [...] }
    structure_json JSONB,
    
    -- [核心设计] 编译后的纯文本 (发送给 LLM 的最终 Prompt)
    -- 存储: "You are a... Your task is..." (包含 Jinja2 变量 {{var}})
    compiled_template TEXT NOT NULL,
    
    -- [核心设计] 变量列表 (用于前端自动生成 Input 框)
    -- 存储: ["user_name", "resume_text"]
    variables JSONB DEFAULT '[]',
    
    -- 模型配置 (Model Configuration)
    -- 存储: { "model_name": "gpt-4o", "temperature": 0.7, "top_p": 1.0, "provider": "openai" }
    config_json JSONB NOT NULL DEFAULT '{}',
    
    -- 变更日志
    commit_message TEXT, -- 用户保存时填写的备注
    created_by VARCHAR(255), -- 暂存 User ID 或 Email
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：加速查询某 Prompt 的历史版本
CREATE INDEX idx_versions_prompt_id ON prompt_versions(prompt_id);
-- 索引：使用 GIN 索引加速 JSONB 查询 (如查询使用 gpt-4 的所有 prompt)
CREATE INDEX idx_versions_config ON prompt_versions USING GIN (config_json);


-- 5. 简单的用户 API Key 映射表 (MVP 阶段 - Client Side Storage Backup)
-- 注意：生产环境建议使用 HashiCorp Vault，MVP 阶段可暂时加密存储在库中或仅存在 LocalStorage
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL, -- 关联到你的 Auth 系统 (Clerk/Auth0)
    provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic'
    encrypted_key TEXT NOT NULL,   -- 必须加密存储！
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

-- ========================================================
-- 预置数据 (Optional: Seeding for Demo)
-- ========================================================

-- 插入一个示例项目
INSERT INTO projects (name, description) VALUES ('Demo Project', 'Initial prompts for testing');

-- 插入一个 Hello World Prompt (需要先获取 project_id，此处仅为逻辑演示)
-- INSERT INTO prompts ...
```