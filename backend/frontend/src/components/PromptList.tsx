/**
 * 提示词列表页面组件
 * 包含搜索栏、列表展示和新建/编辑
 * 已联通后端 FastAPI API
 */
import { useEffect, useState, useRef } from 'react';
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

interface PromptListProps {
  selectedProjectId: string | null;
}

interface PromptDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  project_name?: string;
  updated_at: string;
  version?: string;
  compiled_template: string | { zh: string; en: string };
}

export default function PromptList({ selectedProjectId }: PromptListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [promptDetail, setPromptDetail] = useState<PromptDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contentLang, setContentLang] = useState<'zh' | 'en'>('zh'); // 提示词内容语言切换

  // 编辑器状态（null 表示新建模式，string 表示编辑模式，undefined 表示不显示）
  const [editingPromptId, setEditingPromptId] = useState<string | null | undefined>(undefined);
  
  // 下拉菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // 打开新建编辑器
  const handleNewPrompt = () => {
    setEditingPromptId(null); // null 表示新建模式
  };

  // 刷新列表
  const refreshPrompts = async (selectPromptId?: string): Promise<Prompt[]> => {
    try {
      setLoading(true);
      setError(null);
      
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
      
      // 选择提示词：优先选择指定的，否则保持当前选中，否则选择第一个
      if (selectPromptId) {
        const target = mapped.find(p => p.id === selectPromptId);
        if (target) {
          setSelectedPrompt(target);
        } else {
          setSelectedPrompt(mapped[0] ?? null);
        }
      } else if (selectedPrompt) {
        const stillExists = mapped.find(p => p.id === selectedPrompt.id);
        if (stillExists) {
          setSelectedPrompt(stillExists);
        } else {
          setSelectedPrompt(mapped[0] ?? null);
        }
      } else {
        setSelectedPrompt(mapped[0] ?? null);
      }
      
      return mapped;
    } catch (e: any) {
      setError(e.message ?? '加载列表失败');
      return [];
    } finally {
      setLoading(false);
    }
  };


  // 处理提示词项点击
  const handlePromptClick = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setShowMoreMenu(false); // 切换提示词时关闭菜单
    // 加载提示词详情（包括 compiled_template）
    void loadPromptDetail(prompt.id);
  };

  // 处理提示词项双击（打开编辑对话框）
  const handlePromptDoubleClick = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setEditingPromptId(prompt.id);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMoreMenu]);

  // 加载提示词详情
  const loadPromptDetail = async (promptId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`${API_BASE}/api/v1/prompts/${promptId}`);
      if (!res.ok) {
        throw new Error(`加载详情失败：${res.status}`);
      }
      const data = (await res.json()) as PromptDetail;
      setPromptDetail(data);
    } catch (e: any) {
      console.error('加载提示词详情失败:', e);
      setPromptDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 获取当前语言的提示词内容
  const getCurrentContent = (): string => {
    if (!promptDetail?.compiled_template) return '';
    
    if (typeof promptDetail.compiled_template === 'string') {
      // 旧数据格式：字符串，只有中文
      return promptDetail.compiled_template;
    }
    
    // 新数据格式：JSON {"zh": "...", "en": "..."}
    return promptDetail.compiled_template[contentLang] || '';
  };

  // 拷贝提示词内容
  const handleCopyContent = async () => {
    const content = getCurrentContent();
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // 降级方案：使用传统方法
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const success = document.execCommand('copy');
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          console.error('拷贝失败: execCommand 返回 false');
        }
      } catch (err) {
        console.error('拷贝失败:', err);
      } finally {
        // 确保清理 DOM 元素，避免内存泄漏
        if (document.body.contains(textarea)) {
          document.body.removeChild(textarea);
        }
      }
    }
  };

  // 打开编辑编辑器
  const handleEditPrompt = () => {
    if (!selectedPrompt) return;
    setEditingPromptId(selectedPrompt.id);
  };

  // 编辑器关闭后的回调
  const handleEditorClose = () => {
    setEditingPromptId(undefined);
    // 刷新列表以获取最新数据（保持当前选中）
    void refreshPrompts();
  };

  // 新建成功后的回调
  const handleEditorSaved = async (newPromptId: string) => {
    // 刷新列表并选中新创建的提示词
    const refreshed = await refreshPrompts(newPromptId);
    const newPrompt = refreshed.find(p => p.id === newPromptId);
    if (newPrompt) {
      void loadPromptDetail(newPrompt.id);
    }
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
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `删除失败：${res.status}`);
      }

      // 如果删除的是当前选中的提示词，先清除选中状态
      const wasSelected = selectedPrompt?.id === promptId;
      if (wasSelected) {
        setSelectedPrompt(null);
        setPromptDetail(null);
      }

      // 重新加载列表以确保数据同步
      await refreshPrompts();
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


  return (
    <div className="min-h-screen bg-white">
        {/* 顶部操作栏 - Google 风格 */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              {/* 标题 */}
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">提示词</h1>
                <p className="mt-2 text-base text-gray-600">
                  管理和组织您的 Prompt 集合
                </p>
              </div>

              <div className="flex items-center gap-2">
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
                <div
                  key={prompt.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePromptClick(prompt)}
                  onDoubleClick={() => handlePromptDoubleClick(prompt)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePromptClick(prompt);
                    }
                  }}
                  className={`material-card group flex h-full w-full flex-col p-4 text-left cursor-pointer ${
                    selectedPrompt?.id === prompt.id
                      ? 'ring-2 ring-blue-500'
                      : ''
                  }`}
                >
                  {/* 标题和版本 */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                      {prompt.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {prompt.version && (
                        <span className="rounded bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-600">
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
                    <p className="mt-2 line-clamp-2 text-base text-gray-600">
                      {prompt.description}
                    </p>
                  )}

                  {/* 元信息 */}
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
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
                </div>
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

        {/* 右侧详情面板 - 优化设计 */}
        <div className="lg:w-1/3 lg:border-l lg:border-gray-200 lg:pl-6">
          <div className="sticky top-6 material-card p-5 max-h-[calc(100vh-3rem)] flex flex-col">
            {selectedPrompt ? (
              <div className="flex-1 overflow-y-auto space-y-4 text-sm">
                {/* 基本信息 */}
                <div className="pb-4 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 font-bold text-lg">{selectedPrompt.name}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 relative">
                      <button
                        type="button"
                        onClick={handleEditPrompt}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        title="编辑提示词"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        编辑
                      </button>
                      {/* 更多操作下拉菜单 */}
                      <div className="relative" ref={moreMenuRef}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMoreMenu(!showMoreMenu);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="更多操作"
                          aria-expanded={showMoreMenu}
                          aria-haspopup="true"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {showMoreMenu && (
                          <div 
                            className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                            role="menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMoreMenu(false);
                                handleDeletePrompt();
                              }}
                              className="w-full text-left px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedPrompt.description && (
                    <div className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-3">
                      {selectedPrompt.description}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    {selectedPrompt.projectName && (
                      <span>{selectedPrompt.projectName}</span>
                    )}
                    <span>·</span>
                    <span>{selectedPrompt.updatedAt}</span>
                    {selectedPrompt.version && (
                      <>
                        <span>·</span>
                        <span className="font-mono">v{selectedPrompt.version}</span>
                      </>
                    )}
                    {selectedPrompt.slug && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-gray-400">{selectedPrompt.slug}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 提示词内容 */}
                <div className="flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-700">提示词内容</div>
                      {/* 语言切换标签页 */}
                      {promptDetail?.compiled_template && typeof promptDetail.compiled_template === 'object' && (
                        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-sm">
                          <button
                            type="button"
                            onClick={() => setContentLang('zh')}
                            className={`px-3 py-1 rounded transition-colors font-medium ${
                              contentLang === 'zh'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            中文
                          </button>
                          <button
                            type="button"
                            onClick={() => setContentLang('en')}
                            className={`px-3 py-1 rounded transition-colors font-medium ${
                              contentLang === 'en'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            English
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      disabled={loadingDetail || !getCurrentContent()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="拷贝提示词内容"
                    >
                      {copied ? (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          已拷贝
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          拷贝
                        </>
                      )}
                    </button>
                  </div>
                  {loadingDetail ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        加载中...
                      </div>
                    </div>
                  ) : getCurrentContent() ? (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                        {getCurrentContent()}
                      </pre>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                      {contentLang === 'zh' ? '暂无中文提示词内容' : 'No English prompt content'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500 text-center py-8">
                <div>
                  <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-base">点击左侧列表中的提示词</p>
                  <p className="text-sm mt-1 text-gray-600">快速预览和拷贝内容</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 统一的详情编辑器（支持新建和编辑） */}
      {editingPromptId !== undefined && (
        <PromptDetailEditor
          promptId={editingPromptId}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}

