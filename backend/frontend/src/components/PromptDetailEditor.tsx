/**
 * 提示词详情编辑器（Builder / Code 双模式）
 * 通过后端 /api/v1/prompts/{id} 与 /detail 读写 structure_json & compiled_template
 */
import { useEffect, useState } from 'react';
import React from 'react';
import { API_BASE } from '../config';

interface PromptDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  project_name?: string;
  updated_at: string;
  version?: string;
  structure?: {
    role: string;
    task: string;
    context: string;
    constraints: string[];
    few_shot: { input: string; output: string }[];
  } | null;
  compiled_template: string | { zh: string; en: string };
  config_json?: {
    typical_applications?: string;
    [key: string]: any;
  };
}

interface PromptDetailEditorProps {
  promptId: string | null; // null 表示新建模式
  onClose: () => void;
  onSaved?: (promptId: string) => void; // 新建成功后回调
}

type EditorMode = 'builder' | 'code';
type TabType = 'builder' | 'code' | 'applications';

function extractVariablesFromTemplate(template: string): string[] {
  // {{ variable }} 或 {{variable}}
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const set = new Set<string>();
  let m;
  while ((m = pattern.exec(template))) {
    set.add(m[1]);
  }
  return Array.from(set);
}

// Builder -> Code: 将结构化数据编译成模板文本
function compileBuilderToTemplate(role: string, task: string, context: string, constraints: string[]): string {
  const parts: string[] = [];
  
  if (role.trim()) {
    parts.push(role.trim());
  }
  
  if (task.trim()) {
    parts.push(`\n\n你的任务是：${task.trim()}`);
  }
  
  if (context.trim()) {
    parts.push(`\n\n${context.trim()}`);
  }
  
  if (constraints.length > 0) {
    const constraintsText = constraints
      .map(c => c.trim())
      .filter(Boolean)
      .map(c => `- ${c}`)
      .join('\n');
    if (constraintsText) {
      parts.push(`\n\n约束条件：\n${constraintsText}`);
    }
  }
  
  return parts.join('');
}

// Code -> Builder: 尝试从模板文本解析结构化数据
function parseTemplateToBuilder(template: string): {
  role: string;
  task: string;
  context: string;
  constraints: string[];
} {
  const result = {
    role: '',
    task: '',
    context: '',
    constraints: [] as string[],
  };
  
  if (!template.trim()) {
    return result;
  }
  
  // 尝试解析角色（支持多种角色描述模式）
  // 匹配模式：
  // - 你是/你是一名/你作为/你是一位/你充当...
  // - 作为/作为一名/作为一位/作为一个...（开头，不需要"你"）
  // - 角色描述通常在第一段，可能跨多行，直到遇到明显的任务/上下文分隔
  const rolePatterns = [
    // 模式1: 以"你"开头的角色描述（最常见）
    /^(你(?:是|是一名|作为|是一位|充当|扮演)[^\n]+(?:\n(?!你的?任务|约束|要求|限制|上下文|背景)[^\n]+)*)/,
    // 模式2: 以"作为"开头的角色描述（如"作为AI专家..."）
    /^(作为(?:一名|一位|一个)?[^\n]+(?:\n(?!你的?任务|约束|要求|限制|上下文|背景)[^\n]+)*)/,
    // 模式3: 以"我"开头的角色描述（较少见）
    /^(我(?:是|是一名|作为|是一位)[^\n]+(?:\n(?!你的?任务|约束|要求|限制|上下文|背景)[^\n]+)*)/,
  ];
  
  for (const pattern of rolePatterns) {
    const roleMatch = template.match(pattern);
    if (roleMatch) {
      let roleText = roleMatch[1].trim();
      
      // 清理：移除末尾的标点符号（如果后面紧跟着任务描述）
      roleText = roleText.replace(/[。，、]+$/, '');
      
      // 确保角色描述合理（不超过300字符，且至少包含一些关键词）
      if (roleText.length > 0 && roleText.length <= 300) {
        // 检查是否包含角色相关的关键词
        const roleKeywords = /(专家|顾问|助手|分析师|工程师|设计师|开发者|老师|导师|助手|AI|人工智能)/;
        if (roleKeywords.test(roleText) || roleText.length < 50) {
          result.role = roleText;
          break;
        }
      }
    }
  }
  
  // 尝试解析任务（包含"任务是"、"需要"等关键词）
  const taskMatch = template.match(/(?:你的)?任务(?:是|：|:)\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|约束|$)/);
  if (taskMatch) {
    result.task = taskMatch[1].trim();
  }
  
  // 尝试解析约束条件（包含"约束"、"要求"等关键词，后面跟着列表）
  const constraintsMatch = template.match(/(?:约束条件|要求|限制)(?:：|:)\s*\n?((?:[-•]\s*[^\n]+\n?)+)/);
  if (constraintsMatch) {
    result.constraints = constraintsMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);
  }
  
  // 上下文是剩余部分（去除已解析的部分）
  let context = template;
  if (result.role) {
    context = context.replace(new RegExp(`^${result.role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').trim();
  }
  if (result.task) {
    context = context.replace(new RegExp(`(?:你的)?任务(?:是|：|:)\\s*${result.task.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').trim();
  }
  if (result.constraints.length > 0) {
    const constraintsText = result.constraints.map(c => `- ${c}`).join('\n');
    context = context.replace(new RegExp(`(?:约束条件|要求|限制)(?:：|:)\\s*\\n?${constraintsText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').trim();
  }
  result.context = context;
  
  return result;
}

export function PromptDetailEditor({ promptId, onClose, onSaved }: PromptDetailEditorProps) {
  const isCreateMode = promptId === null;
  const [mode, setMode] = useState<EditorMode>('code');
  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 基本信息（新建和编辑都需要）
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [version, setVersion] = useState('1.0.0');

  // 项目相关状态
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // 本地可编辑结构
  const [role, setRole] = useState('');
  const [task, setTask] = useState('');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState<string>('');
  const [compiledTemplate, setCompiledTemplate] = useState<{ zh: string; en: string }>({ zh: '', en: '' });
  const [codeLang, setCodeLang] = useState<'zh' | 'en'>('zh'); // Code 模式下的语言切换
  const [typicalApplications, setTypicalApplications] = useState<string>(''); // 典型应用内容

  // Playground State
  const [playgroundVars, setPlaygroundVars] = useState<Record<string, string>>({});
  const [playgroundApiKey, setPlaygroundApiKey] = useState<string>('');
  const [playgroundModel, setPlaygroundModel] = useState<string>('gpt-3.5-turbo');
  const [runResult, setRunResult] = useState<null | { 
    result: string; 
    errors: string[]; 
    template: string;
    llm_response?: string | null;
    error?: string;
    model?: string;
  }>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string| null>(null);

  // 加载项目列表
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/projects`);
        if (!res.ok) {
          throw new Error(`加载项目列表失败：${res.status}`);
        }
        const data = (await res.json()) as Array<{ id: string; name: string; description?: string; prompt_count: number }>;
        setProjects(data.map(p => ({ id: p.id, name: p.name })));
      } catch (e: any) {
        console.error('加载项目列表失败:', e);
      }
    };
    void fetchProjects();
  }, []);

  // 加载详情（仅编辑模式）
  useEffect(() => {
    if (isCreateMode) {
      // 新建模式：初始化空数据
      setDetail(null);
      setName('');
      setSlug('');
      setDescription('');
      setProjectName('');
      setVersion('1.0.0');
      setRole('');
      setTask('');
      setContext('');
      setConstraints('');
      setCompiledTemplate({ zh: '', en: '' });
      setTypicalApplications('');
      setIsCreatingNewProject(false);
      setNewProjectName('');
      setLoading(false);
      return;
    }

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/v1/prompts/${promptId}`);
        if (!res.ok) {
          throw new Error(`加载失败：${res.status}`);
        }
        const data = (await res.json()) as PromptDetail;
        setDetail(data);
        // 填充基本信息
        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description || '');
        setProjectName(data.project_name || '');
        setVersion(data.version || '1.0.0');
        setIsCreatingNewProject(false);
        setNewProjectName('');
        // 填充结构化数据
        const s = data.structure ?? {
          role: '',
          task: '',
          context: '',
          constraints: [],
          few_shot: [],
        };
        setRole(s.role ?? '');
        setTask(s.task ?? '');
        setContext(s.context ?? '');
        setConstraints((s.constraints ?? []).join('\n'));
        // 处理 compiled_template：兼容字符串（旧格式）和 JSON（新格式）
        if (typeof data.compiled_template === 'string') {
          setCompiledTemplate({ zh: data.compiled_template, en: '' });
        } else if (data.compiled_template && typeof data.compiled_template === 'object') {
          setCompiledTemplate({ zh: data.compiled_template.zh || '', en: data.compiled_template.en || '' });
        } else {
          setCompiledTemplate({ zh: '', en: '' });
        }
        // 加载典型应用内容
        const typicalApps = data.config_json?.typical_applications || '';
        setTypicalApplications(typicalApps);
      } catch (e: any) {
        setError(e.message ?? '加载详情失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [promptId, isCreateMode]);

  // Builder -> Code: 当 Builder 模式的数据变化时，实时生成 compiled_template
  // 使用 useRef 跟踪是否在 Builder 模式下，避免在 Code 模式下覆盖用户编辑
  const isBuilderModeRef = React.useRef(false);
  
  useEffect(() => {
    isBuilderModeRef.current = mode === 'builder';
  }, [mode]);
  
  useEffect(() => {
    if (mode === 'builder' && isBuilderModeRef.current) {
      const constraintsList = constraints
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean);
      const generated = compileBuilderToTemplate(role, task, context, constraintsList);
      // Builder 模式生成的内容默认是中文，更新到 zh 字段
      setCompiledTemplate(prev => ({ ...prev, zh: generated }));
    }
  }, [mode, role, task, context, constraints]);

  // Code -> Builder: 强制将 Code 内容解析并填充到 Builder
  const handleConvertCodeToBuilder = () => {
    const currentText = compiledTemplate[codeLang] || compiledTemplate.zh || '';
    if (!currentText.trim()) {
      setError('Code 内容为空，无法转换');
      return;
    }
    
    const parsed = parseTemplateToBuilder(currentText);
    
    // 强制填充（覆盖已有数据）
    if (parsed.role) {
      setRole(parsed.role);
    } else {
      setRole('');
    }
    
    if (parsed.task) {
      setTask(parsed.task);
    } else {
      setTask('');
    }
    
    if (parsed.context) {
      setContext(parsed.context);
    } else {
      setContext('');
    }
    
    if (parsed.constraints.length > 0) {
      setConstraints(parsed.constraints.join('\n'));
    } else {
      setConstraints('');
    }
    
    // 切换到 Builder 模式
    setMode('builder');
    setError(null);
  };

  // Code -> Builder: 当切换到 Builder 模式时，尝试从 compiled_template 解析
  const handleModeChange = (newMode: EditorMode) => {
    if (newMode === 'builder' && compiledTemplate && mode === 'code') {
      // 从 Code 模式切换到 Builder 模式时，尝试解析
      // 只有当当前 Builder 字段都为空时，才尝试解析（避免覆盖已有数据）
      const hasBuilderData = role.trim() || task.trim() || context.trim() || constraints.trim();
      
      if (!hasBuilderData) {
        // 使用当前语言的内容进行解析
        const templateText = compiledTemplate[codeLang] || compiledTemplate.zh || '';
        const parsed = parseTemplateToBuilder(templateText);
        // 如果解析出内容，则填充
        if (parsed.role) {
          setRole(parsed.role);
        }
        if (parsed.task) {
          setTask(parsed.task);
        }
        if (parsed.context) {
          setContext(parsed.context);
        }
        if (parsed.constraints.length > 0) {
          setConstraints(parsed.constraints.join('\n'));
        }
      }
    }
    setMode(newMode);
    // 同步更新标签页
    if (newMode === 'builder' || newMode === 'code') {
      setActiveTab(newMode);
    }
  };

  // 处理标签页切换
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // 如果切换到 builder 或 code，同步更新 mode，并触发模式切换逻辑
    if (tab === 'builder' || tab === 'code') {
      handleModeChange(tab);
    }
  };

  // 创建新项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('项目名称不能为空');
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '创建项目失败');
      }

      const created = (await res.json()) as { id: string; name: string };
      
      // 添加到项目列表
      setProjects((prev) => [...prev, { id: created.id, name: created.name }]);
      
      // 设置为当前选中的项目
      setProjectName(created.name);
      setIsCreatingNewProject(false);
      setNewProjectName('');
    } catch (e: any) {
      setError(e.message ?? '创建项目失败');
    }
  };

  // 自动提取变量名（从当前语言的内容中提取）
  const currentTemplateText = compiledTemplate[codeLang] || '';
  const codeVars = React.useMemo(() => extractVariablesFromTemplate(currentTemplateText), [currentTemplateText]);

  // 初始同步变量输入框内容
  useEffect(() => {
    setPlaygroundVars((v) => {
      const next = {...v};
      for (const key of codeVars) if (!(key in next)) next[key] = '';
      for (const key in next) if (!codeVars.includes(key)) delete next[key];
      return next;
    });
    setRunResult(null);
    setRunError(null);
  }, [codeVars]); // 修复：应该依赖 codeVars 而不是 currentTemplateText

  const handleSave = async () => {
    // 验证必填字段
    if (!name.trim()) {
      setError('名称不能为空');
      return;
    }
    if (!slug.trim()) {
      setError('别名（slug）不能为空');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isCreateMode) {
        // 新建模式：先创建提示词
        const createBody = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          project_name: projectName.trim() || null,
          version: version || '1.0.0',
          compiled_template: compiledTemplate,
        };

        const createRes = await fetch(`${API_BASE}/api/v1/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
        });

        if (!createRes.ok) {
          const text = await createRes.text();
          throw new Error(text || '创建失败');
        }

        const created = (await createRes.json()) as PromptDetail;
        const newPromptId = created.id;

        // 创建后立即更新详情（包含结构化数据）
        const updateBody = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          project_name: projectName.trim() || null,
          version: version || '1.0.0',
          structure: {
            role,
            task,
            context,
            constraints: constraints
              .split('\n')
              .map((c) => c.trim())
              .filter(Boolean),
            few_shot: [],
          },
          compiled_template: compiledTemplate,
          config_json: {
            typical_applications: typicalApplications.trim() || undefined,
          },
        };

        const updateRes = await fetch(`${API_BASE}/api/v1/prompts/${newPromptId}/detail`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        });

        if (!updateRes.ok) {
          const text = await updateRes.text();
          throw new Error(text || '更新详情失败');
        }

        const updated = (await updateRes.json()) as PromptDetail;
        setDetail(updated);
        if (onSaved) {
          onSaved(newPromptId);
        }
      } else {
        // 编辑模式：更新现有提示词
        // 合并现有的 config_json，保留其他配置
        const existingConfig = detail?.config_json || {};
        const body = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          project_name: projectName.trim() || null,
          version: version || '1.0.0',
          structure: {
            role,
            task,
            context,
            constraints: constraints
              .split('\n')
              .map((c) => c.trim())
              .filter(Boolean),
            few_shot: [],
          },
          compiled_template: compiledTemplate,
          config_json: {
            ...existingConfig,
            typical_applications: typicalApplications.trim() || undefined,
          },
        };

      const res = await fetch(`${API_BASE}/api/v1/prompts/${promptId}/detail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '保存失败');
      }
      const updated = (await res.json()) as PromptDetail;
      setDetail(updated);
        setName(updated.name);
        setSlug(updated.slug);
        setDescription(updated.description || '');
        setProjectName(updated.project_name || '');
        setVersion(updated.version || '1.0.0');
      }
    } catch (e: any) {
      setError(e.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 运行按钮
  const handleRunPlayground = async () => {
    if (!slug.trim()) {
      setRunError('请先填写别名（slug）以运行提示词');
      return;
    }
    setRunLoading(true); setRunError(null); setRunResult(null);
    try {
      // 使用当前语言的内容运行
      const templateToRun = currentTemplateText;
      
      // 如果当前语言的内容为空，尝试使用另一种语言
      const finalTemplate = templateToRun || (codeLang === 'zh' ? compiledTemplate.en : compiledTemplate.zh) || '';
      
      if (!finalTemplate) {
        setRunError('提示词内容为空，无法运行');
        setRunLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/v1/run/${slug.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          variables: playgroundVars,
          api_key: playgroundApiKey || undefined,
          model: playgroundModel,
          stream: false,
          lang: codeLang, // 传递语言参数，让后端知道使用哪种语言
        })
      });
      if (!res.ok) throw new Error((await res.text()) || '运行失败');
      const result = await res.json();
      setRunResult(result);
    } catch(e:any) {
      setRunError(e.message || '运行失败');
    } finally {
      setRunLoading(false);
    }
  };
  const handleVarChange = (k:string, v:string) => {
    setPlaygroundVars((prev) => ({...prev, [k]: v}));
  };


  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 顶部栏 */}
        <div className="flex flex-col border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                提示词详情
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
          {/* 标签页导航 */}
          <div className="flex items-center gap-1 px-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => handleTabChange('builder')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'builder'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('code')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'code'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('applications')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'applications'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              典型应用
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {loading && <div className="text-sm text-gray-500">正在加载详情...</div>}
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && (detail || isCreateMode) && activeTab === 'builder' && (
            <div className="space-y-5 text-base">
              {/* 基本信息 - 紧凑布局 */}
              <div className="grid gap-4 grid-cols-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">名称 *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：简历解析器"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">别名（slug）*</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：resume-parser"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">项目类别</label>
                  {!isCreatingNewProject ? (
                    <div className="flex gap-2">
                      <select
                        value={projectName}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setIsCreatingNewProject(true);
                            setNewProjectName('');
                          } else {
                            setProjectName(e.target.value);
                          }
                        }}
                        className="flex-1 rounded-md border border-blue-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white hover:border-blue-400 transition-colors"
                      >
                        <option value="">-- 请选择 --</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.name}>
                            {project.name}
                          </option>
                        ))}
                        <option value="__new__">+ 新建项目</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newProjectName.trim()) {
                            handleCreateProject();
                          } else if (e.key === 'Escape') {
                            setIsCreatingNewProject(false);
                            setNewProjectName('');
                          }
                        }}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="输入新项目名称..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={!newProjectName.trim()}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="创建项目"
                      >
                        创建
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewProject(false);
                          setNewProjectName('');
                        }}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        title="取消"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="简单描述该提示词的用途..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">角色（Role）</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：你是一名资深简历分析专家..."
                  />
                  <select
                    onChange={(e) => {
                      const selectedRole = e.target.value;
                      if (selectedRole) {
                        // 如果已有内容，追加换行和选中内容；否则直接设置
                        if (role.trim()) {
                          setRole(role + '\n' + selectedRole);
                        } else {
                          setRole(selectedRole);
                        }
                        // 重置下拉框
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors min-w-[220px]"
                    defaultValue=""
                  >
                    <option value="">选择预设角色...</option>
                    <option value="你是一名 Senior Architect (资深架构师)">Senior Architect (资深架构师)</option>
                    <option value="你是一名 Product Manager (产品经理)">Product Manager (产品经理)</option>
                    <option value="你是一名 Data Scientist (数据科学家)">Data Scientist (数据科学家)</option>
                    <option value="你是一名 UX Designer (用户体验设计师)">UX Designer (用户体验设计师)</option>
                    <option value="你是一名 Copywriter (文案撰稿人)">Copywriter (文案撰稿人)</option>
                    <option value="你是一名 Legal Consultant (法律顾问)">Legal Consultant (法律顾问)</option>
                    <option value="你是一名 Historian (历史学家)">Historian (历史学家)</option>
                    <option value="你是一名 Math Teacher (数学老师)">Math Teacher (数学老师)</option>
                    <option value="你是一名 Career Coach (职业教练)">Career Coach (职业教练)</option>
                    <option value="你是一名 Devil's Advocate (唱反调的人)">Devil's Advocate (唱反调的人)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">核心任务（Task）</label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed"
                  placeholder="说明模型的主要任务和预期输出..."
                />
                {/* 任务增强下拉列表 */}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {/* 语气与风格 */}
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const content = `语气与风格：${selected}`;
                        if (task.trim()) {
                          setTask(task + '\n' + content);
                        } else {
                          setTask(content);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">语气与风格...</option>
                    <option value="Professional (专业的)">Professional (专业的)</option>
                    <option value="Conversational (对话式的)">Conversational (对话式的)</option>
                    <option value="Humorous (幽默的)">Humorous (幽默的)</option>
                    <option value="Empathetic (有同理心的)">Empathetic (有同理心的)</option>
                    <option value="Persuasive (有说服力的)">Persuasive (有说服力的)</option>
                    <option value="Sarcastic (讽刺的 - 适合写段子)">Sarcastic (讽刺的 - 适合写段子)</option>
                    <option value="Minimalist (极简主义的)">Minimalist (极简主义的)</option>
                    <option value="Academic (学术的)">Academic (学术的)</option>
                    <option value="Eli5 (Explain Like I'm 5 - 通俗易懂)">Eli5 (Explain Like I'm 5 - 通俗易懂)</option>
                    <option value="Storytelling (讲故事的)">Storytelling (讲故事的)</option>
                  </select>

                  {/* 输出格式 */}
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const content = `输出格式：${selected}`;
                        if (task.trim()) {
                          setTask(task + '\n' + content);
                        } else {
                          setTask(content);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">输出格式...</option>
                    <option value="Bullet points (子弹列表)">Bullet points (子弹列表)</option>
                    <option value="Markdown table (Markdown表格)">Markdown table (Markdown表格)</option>
                    <option value="JSON format (JSON格式 - 编程必用)">JSON format (JSON格式 - 编程必用)</option>
                    <option value="CSV format (CSV格式 - 数据处理)">CSV format (CSV格式 - 数据处理)</option>
                    <option value="Code block (代码块)">Code block (代码块)</option>
                    <option value="Step-by-step guide (分步指南)">Step-by-step guide (分步指南)</option>
                    <option value="Pros and Cons list (优缺点列表)">Pros and Cons list (优缺点列表)</option>
                    <option value="Mind map structure (思维导图结构)">Mind map structure (思维导图结构)</option>
                    <option value="Executive Summary (高管摘要)">Executive Summary (高管摘要)</option>
                    <option value="ASCII Art (字符画)">ASCII Art (字符画)</option>
                  </select>

                  {/* 编程专用修饰词 */}
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const content = `编程专用修饰词：${selected}`;
                        if (task.trim()) {
                          setTask(task + '\n' + content);
                        } else {
                          setTask(content);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">编程专用修饰词...</option>
                    <option value="Clean code (整洁代码)">Clean code (整洁代码)</option>
                    <option value="Production-ready (生产级可用)">Production-ready (生产级可用)</option>
                    <option value="Highly optimized (高度优化)">Highly optimized (高度优化)</option>
                    <option value="Heavily commented (大量注释)">Heavily commented (大量注释)</option>
                    <option value="Object-Oriented (面向对象的)">Object-Oriented (面向对象的)</option>
                    <option value="Functional style (函数式风格)">Functional style (函数式风格)</option>
                    <option value="Error handling (包含错误处理)">Error handling (包含错误处理)</option>
                    <option value="Secure (安全的)">Secure (安全的)</option>
                    <option value="Scalable (可扩展的)">Scalable (可扩展的)</option>
                    <option value="Thread-safe (线程安全的)">Thread-safe (线程安全的)</option>
                  </select>

                  {/* 内容增强 */}
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const content = `内容增强：${selected}`;
                        if (task.trim()) {
                          setTask(task + '\n' + content);
                        } else {
                          setTask(content);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">内容增强...</option>
                    <option value="Use analogies (使用类比)">Use analogies (使用类比)</option>
                    <option value="Use data/statistics (使用数据/统计)">Use data/statistics (使用数据/统计)</option>
                    <option value="Cite sources (引用来源 - 仅限联网AI)">Cite sources (引用来源 - 仅限联网AI)</option>
                    <option value="Make it punchy (有力度的)">Make it punchy (有力度的)</option>
                    <option value="Avoid fluff (避免废话)">Avoid fluff (避免废话)</option>
                    <option value="Active voice (主动语态)">Active voice (主动语态)</option>
                    <option value="Vivid imagery (生动的意象)">Vivid imagery (生动的意象)</option>
                    <option value="Rhetorical questions (反问句)">Rhetorical questions (反问句)</option>
                    <option value="Call to Action (CTA) (行动号召)">Call to Action (CTA) (行动号召)</option>
                    <option value="SEO-friendly (SEO友好的)">SEO-friendly (SEO友好的)</option>
                  </select>

                  {/* 逻辑与深度 */}
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const content = `逻辑与深度：${selected}`;
                        if (task.trim()) {
                          setTask(task + '\n' + content);
                        } else {
                          setTask(content);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">逻辑与深度...</option>
                    <option value="First Principles (第一性原理)">First Principles (第一性原理)</option>
                    <option value="Counter-intuitive (反直觉的)">Counter-intuitive (反直觉的)</option>
                    <option value="Deep dive (深度挖掘)">Deep dive (深度挖掘)</option>
                    <option value="Holistic view (整体视角)">Holistic view (整体视角)</option>
                    <option value="Granular details (颗粒度细节)">Granular details (颗粒度细节)</option>
                    <option value="Underlying causes (根本原因)">Underlying causes (根本原因)</option>
                    <option value="SWOT Analysis (SWOT分析)">SWOT Analysis (SWOT分析)</option>
                    <option value="Gap Analysis (差距分析)">Gap Analysis (差距分析)</option>
                    <option value="Brainstorming (头脑风暴)">Brainstorming (头脑风暴)</option>
                    <option value="Role-play (角色扮演)">Role-play (角色扮演)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">上下文（Context）</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed"
                  placeholder="提供背景信息，支持 {{变量}} 引用..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  约束条件（Constraints，一行一条）
                </label>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed"
                  placeholder={'例如：\n- 不要使用行话\n- 控制在 200 字以内'}
                />
                {/* 约束条件下拉列表 */}
                <div className="mt-3">
                  <select
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        // 如果已有内容，追加换行和选中内容；否则直接设置
                        if (constraints.trim()) {
                          setConstraints(constraints + '\n' + selected);
                        } else {
                          setConstraints(selected);
                        }
                        // 重置下拉框
                        e.target.value = '';
                      }
                    }}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    defaultValue=""
                  >
                    <option value="">选择预设约束条件...</option>
                    <option value="Max 50 words (最多50字)">Max 50 words (最多50字)</option>
                    <option value="No jargon (无行话)">No jargon (无行话)</option>
                    <option value="Only official documentation (仅限官方文档)">Only official documentation (仅限官方文档)</option>
                    <option value="Do not hallucinate (不要编造)">Do not hallucinate (不要编造)</option>
                    <option value="Strictly follow (严格遵循)">Strictly follow (严格遵循)</option>
                    <option value="Try again (重试)">Try again (重试)</option>
                    <option value="Make it shorter (再短点)">Make it shorter (再短点)</option>
                    <option value="Expand on section X (展开X部分)">Expand on section X (展开X部分)</option>
                    <option value="Simplify (简化)">Simplify (简化)</option>
                    <option value="Correct the logic (修正逻辑)">Correct the logic (修正逻辑)</option>
                    <option value="Give me another option (给我另一个选项)">Give me another option (给我另一个选项)</option>
                    <option value="Format better (格式排版好一点)">Format better (格式排版好一点)</option>
                    <option value="Change the tone to... (把语气改成...)">Change the tone to... (把语气改成...)</option>
                    <option value="Critique your own answer (批判你自己的回答)">Critique your own answer (批判你自己的回答)</option>
                    <option value="Final polish (最后润色)">Final polish (最后润色)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {!loading && (detail || isCreateMode) && activeTab === 'code' && (
            <div className="space-y-6 text-base">
              {/* 基本信息 - 紧凑布局 */}
              <div className="grid gap-4 grid-cols-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">名称 *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：简历解析器"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">别名（slug）*</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="例如：resume-parser"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">项目类别</label>
                  {!isCreatingNewProject ? (
                    <div className="flex gap-2">
                      <select
                        value={projectName}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setIsCreatingNewProject(true);
                            setNewProjectName('');
                          } else {
                            setProjectName(e.target.value);
                          }
                        }}
                        className="flex-1 rounded-md border border-blue-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white hover:border-blue-400 transition-colors"
                      >
                        <option value="">-- 请选择 --</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.name}>
                            {project.name}
                          </option>
                        ))}
                        <option value="__new__">+ 新建项目</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newProjectName.trim()) {
                            handleCreateProject();
                          } else if (e.key === 'Escape') {
                            setIsCreatingNewProject(false);
                            setNewProjectName('');
                          }
                        }}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="输入新项目名称..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={!newProjectName.trim()}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="创建项目"
                      >
                        创建
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewProject(false);
                          setNewProjectName('');
                        }}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        title="取消"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="简单描述该提示词的用途..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    编译后的 Prompt 模板（Code Mode）
                  </label>
                  {/* 语言切换标签页 */}
                  <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-sm">
                    <button
                      type="button"
                      onClick={() => setCodeLang('zh')}
                      className={`px-3 py-1 rounded transition-colors font-medium ${
                        codeLang === 'zh'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      中文
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodeLang('en')}
                      className={`px-3 py-1 rounded transition-colors font-medium ${
                        codeLang === 'en'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConvertCodeToBuilder}
                    disabled={!currentTemplateText.trim()}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white transition-colors"
                    title="将 Code 内容解析并转换到 Builder 模式"
                  >
                    🔄 Builder
                  </button>
                </div>
              </div>
              <textarea
                value={currentTemplateText}
                onChange={(e) => {
                  setCompiledTemplate(prev => ({
                    ...prev,
                    [codeLang]: e.target.value,
                  }));
                }}
                rows={16}
                className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed"
                placeholder={codeLang === 'zh' ? '在此直接编辑完整的 Prompt 文本，支持 {{变量}}。' : 'Edit the complete prompt text here, supports {{variables}}.'}
              />
              {/* Playground 区块 */}
              <div className="rounded-xl bg-gray-50 px-5 py-6 mt-4 border border-gray-200">
                <div className="mb-4 text-sm font-semibold text-gray-700 tracking-wide flex items-center justify-between">
                  <span>Playground 实时预览</span>
                  <button 
                    type="button" 
                    onClick={()=>{
                      setPlaygroundVars({});
                      setRunResult(null);
                      setRunError(null);
                    }} 
                    className="rounded-md bg-white border border-gray-300 text-sm px-3 py-1.5 font-medium text-gray-600 hover:border-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    重置
                  </button>
                </div>

                {/* API Key 和模型配置 */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="mb-1.5 text-sm font-medium text-gray-700">API Key (BYOK)</label>
                    <input
                      type="password"
                      value={playgroundApiKey}
                      onChange={(e) => setPlaygroundApiKey(e.target.value)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="sk-xxx (可选，用于真实 LLM 调用)"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-1.5 text-sm font-medium text-gray-700">模型</label>
                    <select
                      value={playgroundModel}
                      onChange={(e) => setPlaygroundModel(e.target.value)}
                      className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-blue-400 transition-colors"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    </select>
                  </div>
                </div>

                {/* 变量输入 */}
                <div className="mb-4 flex flex-wrap gap-3">
                  {codeVars.length === 0 && <div className="text-sm text-gray-500">模板中未检测到变量</div>}
                  {codeVars.map((k) => (
                    <div key={k} className="flex flex-col">
                      <label className="mb-1.5 text-sm font-mono font-medium text-gray-700">{`{{${k}}}`}</label>
                      <input
                        type="text"
                        value={playgroundVars[k] || ''}
                        onChange={e => handleVarChange(k,e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder={`填写变量${k}`}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRunPlayground}
                  disabled={runLoading || codeVars.length===0}
                  className="inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {runLoading ? '运行中...' : '运行'}
                </button>
                {runError && <div className="mt-3 text-sm text-red-600 font-medium">{runError}</div>}
                {runResult && (
                  <div className="mt-6 space-y-4">
                    {/* 渲染后的 Prompt */}
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">渲染后的 Prompt：</div>
                      <pre className="whitespace-pre-wrap break-all bg-gray-50 p-3 rounded-md text-sm text-gray-800 leading-relaxed">{runResult.result}</pre>
                      {runResult.errors && runResult.errors.length > 0 && (
                        <div className="mt-2 text-sm text-yellow-700 font-medium">⚠️ 缺失变量：{runResult.errors.join(', ')}</div>
                      )}
                    </div>
                    {/* LLM 响应 */}
                    {runResult.llm_response && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <div className="text-sm font-medium text-green-700 mb-2">
                          LLM 响应 {runResult.model && `(${runResult.model})`}：
                        </div>
                        <pre className="whitespace-pre-wrap break-all bg-white p-3 rounded-md text-sm text-gray-800 leading-relaxed">{runResult.llm_response}</pre>
                      </div>
                    )}
                    {runResult.error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="text-sm text-red-700 font-medium">{runResult.error}</div>
                      </div>
                    )}
                    {!runResult.llm_response && !runResult.error && (
                      <div className="text-sm text-gray-600 italic">
                        💡 提示：提供 API Key 以调用真实 LLM，否则仅显示模板渲染结果
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && (detail || isCreateMode) && activeTab === 'applications' && (
            <div className="space-y-5 text-base">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  典型应用案例
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  记录和保存采用此提示词的演化案例，包括应用场景、使用效果、改进建议等。
                </p>
                <textarea
                  value={typicalApplications}
                  onChange={(e) => setTypicalApplications(e.target.value)}
                  rows={20}
                  className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 leading-relaxed font-sans"
                  placeholder="例如：&#10;&#10;案例1：简历解析应用&#10;场景：用于自动解析求职者简历，提取关键信息&#10;效果：准确率达到95%，大幅提升HR工作效率&#10;改进建议：增加对非标准格式简历的支持&#10;&#10;案例2：文档摘要生成&#10;场景：对长文档进行自动摘要&#10;效果：生成摘要质量高，但处理速度较慢&#10;改进建议：优化提示词长度，减少token消耗..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





