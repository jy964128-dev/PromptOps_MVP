/**
 * 项目侧边栏组件
 * 显示项目列表，支持筛选提示词
 */
import { useEffect, useState } from 'react';
import { API_BASE } from '../config';

interface Project {
  id: string;
  name: string;
  description?: string;
  prompt_count: number;
}

interface ProjectSidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export function ProjectSidebar({
  selectedProjectId,
  onSelectProject,
}: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/projects`);
      if (!res.ok) {
        throw new Error(`加载失败：${res.status}`);
      }
      const data = (await res.json()) as Project[];
      setProjects(data);
    } catch (e: any) {
      setError(e.message ?? '加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, []);

  // 删除单个空项目
  const handleDeleteEmptyProject = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(
      `确定要删除空项目 "${projectName}" 吗？\n\n此操作无法恢复。`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: '删除失败' }));
        throw new Error(errorData.detail || `删除失败：${res.status}`);
      }

      // 如果删除的是当前选中的项目，清除选中状态
      if (selectedProjectId === projectId) {
        onSelectProject(null);
      }

      // 重新加载项目列表
      await fetchProjects();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  // 批量删除所有空项目
  const handleDeleteAllEmptyProjects = async () => {
    const emptyProjects = projects.filter((p) => p.prompt_count === 0);
    
    if (emptyProjects.length === 0) {
      alert('没有空项目可删除');
      return;
    }

    const confirmed = window.confirm(
      `确定要删除所有 ${emptyProjects.length} 个空项目吗？\n\n此操作无法恢复。`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/projects/empty/batch`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`删除失败：${res.status}`);
      }

      const data = await res.json();
      alert(data.message || `成功删除 ${data.deleted_count} 个空项目`);

      // 如果删除的项目中包含当前选中的项目，清除选中状态
      if (selectedProjectId && emptyProjects.some((p) => p.id === selectedProjectId)) {
        onSelectProject(null);
      }

      // 重新加载项目列表
      await fetchProjects();
    } catch (e: any) {
      alert(e.message || '批量删除失败');
    }
  };

  return (
    <div className="h-screen w-64 border-r border-gray-200 bg-white">
      {/* 顶部标题 - Google 风格 */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">项目</h2>
          {projects.filter((p) => p.prompt_count === 0).length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllEmptyProjects}
              className="text-xs text-red-600 hover:text-red-700 hover:underline"
              title="删除所有空项目"
            >
              清理
            </button>
          )}
        </div>
      </div>

      {/* 项目列表 */}
      <div className="relative overflow-y-auto px-3 py-3">
        {loading && (
          <div className="px-2 py-4 text-center text-xs text-gray-500">
            <div className="inline-flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              加载中...
            </div>
          </div>
        )}
        {error && (
          <div className="px-2 py-4 text-center text-xs text-red-500">
            {error}
          </div>
        )}

        {/* "全部" 选项 - Google 风格 */}
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className={`mb-1 w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
            selectedProjectId === null
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>全部提示词</span>
            <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {projects.reduce((sum, p) => sum + p.prompt_count, 0)}
            </span>
          </div>
        </button>

        {/* 项目列表 - Google 风格 */}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`mb-1 group rounded-md transition-colors ${
              selectedProjectId === project.id
                ? 'bg-blue-50'
                : 'hover:bg-gray-50'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                selectedProjectId === project.id
                  ? 'text-blue-700 font-medium'
                  : 'text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{project.name}</div>
                  {project.description && (
                    <div className="mt-0.5 truncate text-gray-500">
                      {project.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    project.prompt_count === 0
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {project.prompt_count}
                  </span>
                  {project.prompt_count === 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteEmptyProject(project.id, project.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-red-500 hover:bg-red-50 transition-all"
                      title="删除空项目"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </button>
          </div>
        ))}

        {projects.length === 0 && !loading && (
          <div className="px-2 py-4 text-center text-xs text-gray-400">
            暂无项目
          </div>
        )}
      </div>
    </div>
  );
}

