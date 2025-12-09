/**
 * About 组件 - 软件信息弹窗
 * 展示软件版本、介绍、功能点和作者信息
 */


interface AboutProps {
  onClose: () => void;
}

export function About({ onClose }: AboutProps) {
  const softwareVersion = '1.0.0';
  const author = '唐小果';
  
  const features = [
    '提示词版本管理 - 支持多版本管理和历史回溯',
    'Builder/Code 双模式 - 可视化构建或直接编辑模板',
    '实时测试与评估 - Playground 预览和真实 LLM 调用',
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">关于 PromptOps</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="space-y-6">
            {/* Logo 和基本信息 */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex-shrink-0">
                <img
                  src="/logo.jpg"
                  alt="PromptOps Logo"
                  className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    // 如果图片加载失败，显示占位符
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (!target.nextElementSibling) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs';
                      placeholder.textContent = 'Logo';
                      target.parentNode?.appendChild(placeholder);
                    }
                  }}
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">PromptOps</h3>
                <p className="text-xs text-gray-500 mt-1">v{softwareVersion} · {author}</p>
              </div>
            </div>

            {/* 软件介绍 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">软件介绍</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                PromptOps 是一个基于 AI 的 Prompt 生命周期管理系统，专为企业内部研发与产品人员设计。
                系统提供完整的提示词管理、测试评估和团队协作功能，帮助团队高效管理和优化 AI 提示词。
              </p>
            </div>

            {/* 核心功能点 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">核心功能</h4>
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 技术栈 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">技术栈</h4>
              <div className="flex flex-wrap gap-2">
                {['Python', 'React', 'TypeScript', 'FastAPI', 'SQLAlchemy', 'SQLite / PostgreSQL', 'Tailwind CSS', 'LiteLLM'].map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* 版权信息 */}
            <div className="border-t border-gray-200 pt-4">
              <div className="text-xs text-gray-400 text-center">
                © 2025 PromptOps
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

