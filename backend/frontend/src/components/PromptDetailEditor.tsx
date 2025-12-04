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
  compiled_template: string;
}

interface PromptDetailEditorProps {
  promptId: string;
  onClose: () => void;
}

type EditorMode = 'builder' | 'code';

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

export function PromptDetailEditor({ promptId, onClose }: PromptDetailEditorProps) {
  const [mode, setMode] = useState<EditorMode>('builder');
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 本地可编辑结构
  const [role, setRole] = useState('');
  const [task, setTask] = useState('');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState<string>('');
  const [compiledTemplate, setCompiledTemplate] = useState('');

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

  // 加载详情
  useEffect(() => {
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
        setCompiledTemplate(data.compiled_template ?? '');
      } catch (e: any) {
        setError(e.message ?? '加载详情失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [promptId]);

  // 自动提取变量名
  const codeVars = React.useMemo(() => extractVariablesFromTemplate(compiledTemplate), [compiledTemplate]);

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
  }, [compiledTemplate]);

  const handleSave = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      setError(null);
      const body = {
        name: detail.name,
        slug: detail.slug,
        description: detail.description ?? null,
        project_name: detail.project_name ?? null,
        version: detail.version ?? '1.0.0',
        structure: {
          role,
          task,
          context,
          constraints: constraints
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean),
          few_shot: [], // MVP 先不做 UI
        },
        compiled_template: compiledTemplate,
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
    } catch (e: any) {
      setError(e.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 运行按钮
  const handleRunPlayground = async () => {
    if (!detail) return;
    setRunLoading(true); setRunError(null); setRunResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/run/${detail.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          variables: playgroundVars,
          api_key: playgroundApiKey || undefined,
          model: playgroundModel,
          stream: false,
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
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {detail ? detail.name : '加载中...'}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              提示词详情 · Builder / Code 双模式
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('builder')}
                className={`rounded-full px-3 py-1 ${
                  mode === 'builder'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Builder
              </button>
              <button
                type="button"
                onClick={() => setMode('code')}
                className={`rounded-full px-3 py-1 ${
                  mode === 'code'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Code
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !detail}
              className="rounded-full bg-gray-900 px-4 py-1 text-xs font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading && <div className="text-xs text-gray-500">正在加载详情...</div>}
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {!loading && detail && mode === 'builder' && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-gray-500">名称</div>
                  <input
                    value={detail.name}
                    onChange={(e) =>
                      setDetail((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">别名（slug）</div>
                  <input
                    value={detail.slug}
                    onChange={(e) =>
                      setDetail((prev) =>
                        prev ? { ...prev, slug: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="text-xs font-medium text-gray-500">角色（Role）</div>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                placeholder="例如：你是一名资深简历分析专家..."
              />

              <div>
                <div className="text-xs font-medium text-gray-500">核心任务（Task）</div>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="说明模型的主要任务和预期输出..."
                />
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500">上下文（Context）</div>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="提供背景信息，支持 {{变量}} 引用..."
                />
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500">
                  约束条件（Constraints，一行一条）
                </div>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder={'例如：\n- 不要使用行话\n- 控制在 200 字以内'}
                />
              </div>
            </div>
          )}

          {!loading && detail && mode === 'code' && (
            <div className="space-y-6 text-sm">
              <div className="text-xs font-medium text-gray-500">
                编译后的 Prompt 模板（Code Mode）
              </div>
              <textarea
                value={compiledTemplate}
                onChange={(e) => setCompiledTemplate(e.target.value)}
                rows={14}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                placeholder="在此直接编辑完整的 Prompt 文本，支持 {{变量}}。"
              />
              {/* Playground 区块 */}
              <div className="rounded-xl bg-gray-50 px-4 py-5 mt-2 border border-gray-200">
                <div className="mb-3 text-xs font-semibold text-gray-700 tracking-wide flex items-center justify-between">
                  <span>Playground 实时预览</span>
                  <button 
                    type="button" 
                    onClick={()=>{
                      setPlaygroundVars({});
                      setRunResult(null);
                      setRunError(null);
                    }} 
                    className="rounded bg-white border border-gray-300 text-xs px-2 py-0.5 text-gray-500 hover:border-gray-900"
                  >
                    重置
                  </button>
                </div>

                {/* API Key 和模型配置 */}
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div className="flex flex-col text-xs">
                    <label className="mb-0.5 text-gray-600">API Key (BYOK)</label>
                    <input
                      type="password"
                      value={playgroundApiKey}
                      onChange={(e) => setPlaygroundApiKey(e.target.value)}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs placeholder-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      placeholder="sk-xxx (可选，用于真实 LLM 调用)"
                    />
                  </div>
                  <div className="flex flex-col text-xs">
                    <label className="mb-0.5 text-gray-600">模型</label>
                    <select
                      value={playgroundModel}
                      onChange={(e) => setPlaygroundModel(e.target.value)}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-gray-900 focus:ring-gray-900"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    </select>
                  </div>
                </div>

                {/* 变量输入 */}
                <div className="mb-3 flex flex-wrap gap-3">
                  {codeVars.length === 0 && <div className="text-xs text-gray-400">模板中未检测到变量</div>}
                  {codeVars.map((k) => (
                    <div key={k} className="flex flex-col text-xs">
                      <label className="mb-0.5 font-mono text-gray-600">{`{{${k}}}`}</label>
                      <input
                        type="text"
                        value={playgroundVars[k] || ''}
                        onChange={e => handleVarChange(k,e.target.value)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs placeholder-gray-300 focus:border-gray-900 focus:ring-gray-900"
                        placeholder={`填写变量${k}`}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRunPlayground}
                  disabled={runLoading || codeVars.length===0}
                  className="inline-block rounded bg-black px-5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {runLoading ? '运行中...' : '运行'}
                </button>
                {runError && <div className="mt-2 text-xs text-red-500">{runError}</div>}
                {runResult && (
                  <div className="mt-6 space-y-3">
                    {/* 渲染后的 Prompt */}
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
                      <div className="text-xs font-medium text-gray-500 mb-1">渲染后的 Prompt：</div>
                      <pre className="whitespace-pre-wrap break-all bg-gray-50 p-2 rounded text-xs text-gray-800">{runResult.result}</pre>
                      {runResult.errors && runResult.errors.length > 0 && (
                        <div className="mt-2 text-xs text-yellow-600">⚠️ 缺失变量：{runResult.errors.join(', ')}</div>
                      )}
                    </div>
                    {/* LLM 响应 */}
                    {runResult.llm_response && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <div className="text-xs font-medium text-green-700 mb-1">
                          LLM 响应 {runResult.model && `(${runResult.model})`}：
                        </div>
                        <pre className="whitespace-pre-wrap break-all bg-white p-2 rounded text-xs text-gray-800">{runResult.llm_response}</pre>
                      </div>
                    )}
                    {runResult.error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="text-xs text-red-700">{runResult.error}</div>
                      </div>
                    )}
                    {!runResult.llm_response && !runResult.error && (
                      <div className="text-xs text-gray-500 italic">
                        💡 提示：提供 API Key 以调用真实 LLM，否则仅显示模板渲染结果
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





