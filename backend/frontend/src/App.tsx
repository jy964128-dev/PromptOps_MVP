import { useState, useEffect } from 'react';
import PromptList from './components/PromptList';
import PromptListTable from './components/PromptListTable';
import Dashboard from './components/Dashboard';
import { ProjectSidebar } from './components/ProjectSidebar';
import { About } from './components/About';
import { API_BASE, testAPIConnection } from './config';

type ViewMode = 'list' | 'prompt-list' | 'dashboard';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAbout, setShowAbout] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 应用启动时检查 API 配置和连接
  useEffect(() => {
    console.log('🚀 PromptOps 应用启动');
    console.log('📡 API 配置:');
    console.log('   - API_BASE:', API_BASE);
    console.log('   - 环境变量 VITE_API_BASE:', import.meta.env.VITE_API_BASE || '(未设置，使用默认值)');
    console.log('   - 当前环境:', import.meta.env.MODE);
    
    // 测试 API 连接
    testAPIConnection().then((result) => {
      if (result.success) {
        console.log('✅ API 连接成功:', result.message);
      } else {
        console.error('❌ API 连接失败:', result.message);
        console.error('   请检查:');
        console.error('   1. 后端服务是否运行 (默认: http://127.0.0.1:8000)');
        console.error('   2. API_BASE 配置是否正确 (当前:', API_BASE, ')');
        console.error('   3. 网络连接是否正常');
      }
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 左侧项目导航栏 */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarCollapsed ? 'w-0' : 'w-64'
        }`}
      >
        <ProjectSidebar
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
        />
      </div>
      {/* 中间主内容区 */}
      <div className="flex-1 overflow-auto">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              {/* 侧边栏切换按钮 */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title={sidebarCollapsed ? '展开项目栏' : '收起项目栏'}
              >
                {sidebarCollapsed ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                提示词信息
              </button>
              <button
                onClick={() => setViewMode('prompt-list')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'prompt-list'
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
                数据分析
              </button>
            </div>
            <button
              onClick={() => setShowAbout(true)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              关于
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        {viewMode === 'list' ? (
          <PromptList selectedProjectId={selectedProjectId} />
        ) : viewMode === 'prompt-list' ? (
          <PromptListTable selectedProjectId={selectedProjectId} />
        ) : (
          <Dashboard />
        )}
      </div>

      {/* About 弹窗 */}
      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </div>
  );
}

export default App
