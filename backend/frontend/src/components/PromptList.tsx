/**
 * 提示词列表页面组件
 * 包含搜索栏、列表展示和新建/编辑
 * 已联通后端 FastAPI API
 */
import { useEffect, useState } from 'react';
import { PromptDetailEditor } from './PromptDetailEditor';
import { API_BASE } from '../config';

// 提示词数据类型定义
interface Prompt {
  id: string;
  name: string;
  description?: string;
  slug: string;
  projectName?: string;
  updatedAt: string;
  version?: string;
}

type PromptFormMode = 'create' | 'edit';

interface PromptListProps {
  selectedProjectId: string | null;
}

export default function PromptList({ selectedProjectId }: PromptListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新建/编辑表单状态
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<PromptFormMode>('create');
  const [formValues, setFormValues] = useState<{
    name: string;
    slug: string;
    description: string;
    projectName: string;
    version: string;
  }>({
    name: '',
    slug: '',
    description: '',
    projectName: '',
    version: '1.0.0',
  });
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  // 加载后端数据（根据选中的项目筛选）
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 如果选中了项目，调用项目下的提示词接口；否则调用全部提示词接口
        const url = selectedProjectId
          ? `${API_BASE}/api/v1/projects/${selectedProjectId}/prompts`
          : `${API_BASE}/api/v1/prompts`;
        
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`加载失败：${res.status}`);
        }
        const data = (await res.json()) as any[];
        const mapped: Prompt[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? '',
          slug: item.slug,
          projectName: item.project_name ?? '',
          updatedAt: item.updated_at ?? '',
          version: item.version ?? '',
        }));
        setPrompts(mapped);
        setSelectedPrompt(mapped[0] ?? null);
      } catch (e: any) {
        setError(e.message ?? '加载列表失败');
      } finally {
        setLoading(false);
      }
    };

    void fetchPrompts();
  }, [selectedProjectId]);

  // 过滤提示词列表
  const filteredPrompts = prompts.filter(
    (prompt) =>
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 打开新建表单
  const handleNewPrompt = () => {
    setFormMode('create');
    setFormValues({
      name: '',
      slug: '',
      description: '',
      projectName: '',
      version: '1.0.0',
    });
    setShowForm(true);
  };

  // 导出提示词
  const handleExportPrompts = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/prompts/export`);
      if (!res.ok) {
        throw new Error(`导出失败：${res.status}`);
      }

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompts_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? '导出失败');
    }
  };

  // 导入提示词
  const handleImportPrompts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.json')) {
      setError('请选择 JSON 格式的文件');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/v1/prompts/import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: '导入失败' }));
        throw new Error(errorData.detail || `导入失败：${res.status}`);
      }

      const result = await res.json();
      
      // 显示导入结果
      const message = `导入完成！\n成功导入：${result.imported} 个\n跳过：${result.skipped} 个${
        result.errors && result.errors.length > 0 
          ? `\n\n错误：\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n...还有 ${result.errors.length - 5} 个错误` : ''}`
          : ''
      }`;
      alert(message);

      // 重新加载列表
      // 通过触发 useEffect 来刷新列表（通过改变 selectedProjectId 的依赖）
      // 但更好的方式是直接调用 API 刷新
      try {
        const url = selectedProjectId
          ? `${API_BASE}/api/v1/projects/${selectedProjectId}/prompts`
          : `${API_BASE}/api/v1/prompts`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as any[];
          const mapped: Prompt[] = data.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? '',
            slug: item.slug,
            projectName: item.project_name ?? '',
            updatedAt: item.updated_at ?? '',
            version: item.version ?? '',
          }));
          setPrompts(mapped);
          setSelectedPrompt(mapped[0] ?? null);
        }
      } catch (e) {
        // 静默失败，用户可以通过手动刷新页面来查看新数据
        console.error('刷新列表失败:', e);
      }
    } catch (e: any) {
      setError(e.message ?? '导入失败');
    } finally {
      setLoading(false);
      // 清空文件输入，以便再次选择同一文件时也能触发
      event.target.value = '';
    }
  };

  // 处理提示词项点击
  const handlePromptClick = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
  };

  // 打开编辑表单
  const handleEditPrompt = () => {
    if (!selectedPrompt) return;
    setEditingPromptId(selectedPrompt.id);
    setFormMode('edit');
    setFormValues({
      name: selectedPrompt.name,
      slug: selectedPrompt.slug,
      description: selectedPrompt.description ?? '',
      projectName: selectedPrompt.projectName ?? '',
      version: selectedPrompt.version ?? '1.0.0',
    });
    setShowForm(true);
  };

  // 删除提示词（通过 ID）
  const handleDeletePromptById = async (promptId: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/prompts/${promptId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('提示词不存在');
        }
        throw new Error(`删除失败：${res.status}`);
      }

      // 删除成功后，从列表中移除
      setPrompts((prev) => prev.filter((p) => p.id !== promptId));
      
      // 如果删除的是当前选中的提示词，清除选中状态
      if (selectedPrompt?.id === promptId) {
        setSelectedPrompt(null);
      }

      // 重新加载列表以确保数据同步
      const fetchPrompts = async () => {
        try {
          setLoading(true);
          const url = selectedProjectId
            ? `${API_BASE}/api/v1/projects/${selectedProjectId}/prompts`
            : `${API_BASE}/api/v1/prompts`;
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`加载失败：${res.status}`);
          }
          const data = (await res.json()) as any[];
          const mapped: Prompt[] = data.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? '',
            slug: item.slug,
            projectName: item.project_name ?? '',
            updatedAt: item.updated_at ?? '',
            version: item.version ?? '',
          }));
          setPrompts(mapped);
          // 如果当前选中的被删除了，选择第一个；否则保持选中
          if (selectedPrompt?.id === promptId) {
            setSelectedPrompt(mapped[0] ?? null);
          }
        } catch (e: any) {
          setError(e.message ?? '加载列表失败');
        } finally {
          setLoading(false);
        }
      };

      void fetchPrompts();
    } catch (e: any) {
      setError(e.message ?? '删除失败');
    }
  };

  // 删除当前选中的提示词
  const handleDeletePrompt = async () => {
    if (!selectedPrompt) return;

    // 确认对话框
    const confirmed = window.confirm(
      `确定要删除提示词 "${selectedPrompt.name}" 吗？\n\n此操作将永久删除该提示词及其所有版本，且无法恢复。`
    );

    if (!confirmed) return;

    await handleDeletePromptById(selectedPrompt.id);
  };

  // 表单字段更新
  const updateFormField = (field: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  // 提交新建/编辑
  const handleSubmitForm = async () => {
    try {
      setError(null);
      const payload = {
        name: formValues.name,
        slug: formValues.slug,
        description: formValues.description || null,
        project_name: formValues.projectName || null,
        version: formValues.version || '1.0.0',
      };

      let res: Response;
      if (formMode === 'create') {
        res = await fetch(`${API_BASE}/api/v1/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, compiled_template: '' }),
        });
      } else {
        if (!selectedPrompt) return;
        res = await fetch(`${API_BASE}/api/v1/prompts/${selectedPrompt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            compiled_template: undefined,
          }),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '保存失败');
      }

      const item = await res.json();
      const mapped: Prompt = {
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        slug: item.slug,
        projectName: item.project_name ?? '',
        updatedAt: item.updated_at ?? '',
        version: item.version ?? '',
      };

      setPrompts((prev) => {
        const existsIndex = prev.findIndex((p) => p.id === mapped.id);
        if (existsIndex === -1) {
          return [mapped, ...prev];
        }
        const clone = [...prev];
        clone[existsIndex] = mapped;
        return clone;
      });
      setSelectedPrompt(mapped);
      setShowForm(false);
    } catch (e: any) {
      setError(e.message ?? '保存失败');
    }
  };

  return (
    <div className="min-h-screen bg-white">
        {/* 顶部操作栏 - Google 风格 */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              {/* 标题 */}
              <div>
                <h1 className="text-2xl font-normal text-gray-900">提示词</h1>
                <p className="mt-1 text-sm text-gray-500">
                  管理和组织您的 Prompt 集合
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* 导入按钮 */}
                <label className="material-button inline-flex items-center gap-2 cursor-pointer">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  导入
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportPrompts}
                    className="hidden"
                  />
                </label>
                {/* 导出按钮 */}
                <button
                  onClick={handleExportPrompts}
                  className="material-button inline-flex items-center gap-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  导出
                </button>
                {/* 新建按钮 - Material Design */}
                <button
                  onClick={handleNewPrompt}
                  className="material-button inline-flex items-center gap-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  新建提示词
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索栏 - Google 风格 */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="relative max-w-2xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索提示词..."
                className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

      {/* 主体区域：列表 + 右侧详情 */}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
          {/* 提示词列表 */}
          <div className="lg:w-2/3">
          {loading && (
            <div className="py-12 text-center text-sm text-gray-500">
              正在加载提示词...
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && filteredPrompts.length === 0 ? (
          // 空状态 - Google 风格
          <div className="flex flex-col items-center justify-center py-16">
            <svg
              className="h-16 w-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-base font-medium text-gray-900">
              {searchQuery ? '未找到匹配的提示词' : '暂无提示词'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchQuery
                ? '尝试使用其他关键词搜索'
                : '创建您的第一个提示词开始使用'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleNewPrompt}
                className="mt-6 material-button inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                新建提示词
              </button>
            )}
          </div>
          ) : (
            // 列表展示 - Material Design 卡片
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className={`material-card group flex h-full w-full flex-col p-4 text-left ${
                    selectedPrompt?.id === prompt.id
                      ? 'ring-2 ring-blue-500'
                      : ''
                  }`}
                >
                  {/* 标题和版本 */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-medium text-gray-900 group-hover:text-blue-600">
                      {prompt.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {prompt.version && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          v{prompt.version}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmed = window.confirm(
                            `确定要删除提示词 "${prompt.name}" 吗？\n\n此操作将永久删除该提示词及其所有版本，且无法恢复。`
                          );
                          if (confirmed) {
                            handleDeletePromptById(prompt.id);
                          }
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="删除"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* 描述 */}
                  {prompt.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {prompt.description}
                    </p>
                  )}

                  {/* 元信息 */}
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      {prompt.projectName && (
                        <span className="flex items-center gap-1">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                          {prompt.projectName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {prompt.updatedAt}
                      </span>
                    </div>
                    <span className="font-mono text-gray-400">{prompt.slug}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 统计信息 */}
          {filteredPrompts.length > 0 && (
            <div className="mt-8 text-center text-sm text-gray-500">
              显示 {filteredPrompts.length} / {prompts.length} 个提示词
            </div>
          )}
        </div>

        {/* 右侧详情面板 - Google 风格 */}
        <div className="lg:w-1/3 lg:border-l lg:border-gray-200 lg:pl-6">
          <div className="sticky top-6 material-card p-5">
            <h2 className="text-sm font-medium text-gray-900 mb-1">提示词详情</h2>
            <p className="text-xs text-gray-500 mb-4">
              点击左侧列表中的任意一条，可以在这里快速预览元信息。
            </p>

            {selectedPrompt ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">名称</div>
                  <div className="text-gray-900">{selectedPrompt.name}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">别名（slug）</div>
                  <div className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">
                    {selectedPrompt.slug}
                  </div>
                </div>
                {selectedPrompt.description && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">描述</div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {selectedPrompt.description}
                    </div>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-gray-500">
                  {selectedPrompt.projectName && (
                    <span>项目：{selectedPrompt.projectName}</span>
                  )}
                  <span>最近修改：{selectedPrompt.updatedAt}</span>
                </div>
                {selectedPrompt.version && (
                  <div className="text-xs text-gray-500">
                    当前版本：<span className="font-mono">v{selectedPrompt.version}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 text-sm text-gray-500 text-center py-4">
                暂未选择提示词，请从左侧列表中选择一条。
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleNewPrompt}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                新建
              </button>
              <button
                type="button"
                onClick={handleEditPrompt}
                disabled={!selectedPrompt}
                className="inline-flex flex-1 items-center justify-center gap-2 material-button text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={handleDeletePrompt}
                disabled={!selectedPrompt}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新建/编辑表单弹层 */}
      {showForm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              {formMode === 'create' ? '新建提示词' : '编辑提示词'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              当前为 MVP 阶段的基础表单，提交后会直接保存到后端 SQLite 数据库。
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-500">名称</div>
                <input
                  value={formValues.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="例如：简历解析器"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">别名（slug）</div>
                <input
                  value={formValues.slug}
                  onChange={(e) => updateFormField('slug', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="例如：resume-parser"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">项目名称</div>
                <input
                  value={formValues.projectName}
                  onChange={(e) => updateFormField('projectName', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="例如：HR Bots"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">描述</div>
                <textarea
                  value={formValues.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="简单描述该提示词的用途..."
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">版本号</div>
                <input
                  value={formValues.version}
                  onChange={(e) => updateFormField('version', e.target.value)}
                  className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder="1.0.0"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={handleSubmitForm}
                className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-black"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情编辑器（A: Builder / Code 模式） */}
      {editingPromptId && (
        <PromptDetailEditor
          promptId={editingPromptId}
          onClose={() => setEditingPromptId(null)}
        />
      )}
    </div>
  );
}

