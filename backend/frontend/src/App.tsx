import { useState } from 'react';
import PromptList from './components/PromptList';
import Dashboard from './components/Dashboard';
import { ProjectSidebar } from './components/ProjectSidebar';

type ViewMode = 'list' | 'dashboard';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 左侧项目导航栏 */}
      <ProjectSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />
      {/* 中间主内容区 */}
      <div className="flex-1 overflow-auto">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                提示词列表
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'dashboard'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                数据大屏
              </button>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        {viewMode === 'list' ? (
          <PromptList selectedProjectId={selectedProjectId} />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}

export default App
