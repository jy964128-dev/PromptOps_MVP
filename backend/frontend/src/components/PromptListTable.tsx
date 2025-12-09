/**
 * 提示词列表表格组件
 * 以表格形式展示所有提示词的详细信息
 */
import { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../config';

interface PromptListTableProps {
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
  structure?: {
    role: string;
    task: string;
    context: string;
    constraints: string[];
    few_shot: { input: string; output: string }[];
  } | null;
  compiled_template: string | { zh: string; en: string };
  config_json?: Record<string, any>;
}

export default function PromptListTable({ selectedProjectId }: PromptListTableProps) {
  const [prompts, setPrompts] = useState<PromptDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载所有提示词详情（提取为独立函数以便复用）
  const fetchAllPrompts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 先获取提示词列表
      const listUrl = selectedProjectId
        ? `${API_BASE}/api/v1/projects/${selectedProjectId}/prompts`
        : `${API_BASE}/api/v1/prompts`;
      
      const listRes = await fetch(listUrl);
      if (!listRes.ok) {
        throw new Error(`加载列表失败：${listRes.status}`);
      }
      const promptList = (await listRes.json()) as Array<{ id: string }>;

      // 获取每个提示词的详情
      const detailPromises = promptList.map(async (prompt) => {
        const detailRes = await fetch(`${API_BASE}/api/v1/prompts/${prompt.id}`);
        if (!detailRes.ok) {
          console.error(`加载提示词 ${prompt.id} 详情失败：${detailRes.status}`);
          return null;
        }
        return (await detailRes.json()) as PromptDetail;
      });

      const details = await Promise.all(detailPromises);
      setPrompts(details.filter((d): d is PromptDetail => d !== null));
    } catch (e: any) {
      setError(e.message ?? '加载提示词列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  // 加载所有提示词详情
  useEffect(() => {
    void fetchAllPrompts();
  }, [fetchAllPrompts]);

  // 导出提示词
  const handleExportPrompts = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/v1/prompts/export`);
      if (!res.ok) {
        throw new Error(`导出失败：${res.status}`);
      }

      // 获取 Excel 文件 blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 从响应头获取文件名，如果没有则使用默认名称
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `prompts_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
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
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('请选择 Excel 格式的文件（.xlsx 或 .xls）');
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
      await fetchAllPrompts();
    } catch (e: any) {
      setError(e.message ?? '导入失败');
    } finally {
      setLoading(false);
      // 清空文件输入，以便再次选择同一文件时也能触发
      event.target.value = '';
    }
  };

  // 获取编译后的模板文本（优先中文，其次英文）
  const getTemplateText = (template: string | { zh: string; en: string }): string => {
    if (typeof template === 'string') {
      return template;
    }
    return template.zh || template.en || '';
  };

 

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">正在加载提示词列表...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-4 bg-gray-50 min-h-screen">
      {/* 操作栏 */}
      <div className="mb-4 flex items-center justify-end gap-2">
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
            accept=".xlsx,.xls"
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
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  序号
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  别名 (Slug)
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  描述
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  项目类别
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  提示词内容
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {prompts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">暂无提示词</p>
                    </div>
                  </td>
                </tr>
              ) : (
                prompts.map((prompt, index) => (
                  <tr 
                    key={prompt.id} 
                    className="hover:bg-blue-50/30 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-base font-semibold text-gray-900">{prompt.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="px-2.5 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">
                        {prompt.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-base text-gray-600 line-clamp-2">
                        {prompt.description || <span className="text-gray-400 italic">无描述</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {prompt.project_name ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {prompt.project_name}
                        </span>
                      ) : (
                        <span className="text-base text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-lg">
                      <div className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-words line-clamp-4 bg-gray-50 rounded-md p-3 border border-gray-200 leading-relaxed">
                        {getTemplateText(prompt.compiled_template) || <span className="text-gray-400 italic">无内容</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

