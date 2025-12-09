/**
 * 数据分析组件
 * 展示系统统计数据和趋势分析
 */
import { useEffect, useState, useRef } from 'react'; 
import {
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { API_BASE } from '../config';

interface OverviewStats {
  total_prompts: number;
  total_projects: number;
  total_versions: number;
  recent_prompts: number;
}

interface TrendData {
  date: string;
  count: number;
}

interface ProjectDistribution {
  name: string;
  count: number;
}

interface RecentPrompt {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  project_name: string | null;
}

interface VersionStats {
  total_versions: number;
  prompts_with_versions: number;
  avg_versions_per_prompt: number;
}

// 简洁的配色方案
const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
};

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [distribution, setDistribution] = useState<ProjectDistribution[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<RecentPrompt[]>([]);
  const [versionStats, setVersionStats] = useState<VersionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // 检查当前全屏状态
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement)
      );
    };
    checkFullscreen();
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        const [overviewRes, trendsRes, distributionRes, recentRes, versionRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/stats/overview`),
          fetch(`${API_BASE}/api/v1/stats/trends`),
          fetch(`${API_BASE}/api/v1/stats/project-distribution`),
          fetch(`${API_BASE}/api/v1/stats/recent-prompts`),
          fetch(`${API_BASE}/api/v1/stats/version-stats`),
        ]);

        if (overviewRes.ok) {
          const data = await overviewRes.json();
          setOverview(data);
        }

        if (trendsRes.ok) {
          const data = await trendsRes.json();
          setTrends(Array.isArray(data) ? data : []);
        }

        if (distributionRes.ok) {
          const data = await distributionRes.json();
          setDistribution(Array.isArray(data) ? data : []);
        }

        if (recentRes.ok) {
          const data = await recentRes.json();
          setRecentPrompts(Array.isArray(data) ? data : []);
        }

        if (versionRes.ok) {
          const data = await versionRes.json();
          setVersionStats(data);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchAllData();
    
    const interval = setInterval(() => {
      void fetchAllData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.error('退出全屏失败:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement)
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isCurrentlyFullscreen =
          !!(document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement);
        if (isCurrentlyFullscreen) {
          void exitFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const enterFullscreen = async () => {
    const element = dashboardRef.current;
    if (!element) return;

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.error('进入全屏失败:', error);
    }
  };


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-sm text-gray-500">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dashboardRef}
      className={`min-h-screen bg-gray-50 ${isFullscreen ? 'h-screen p-4' : 'p-6'}`}
    >
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">数据分析</h1>
          <p className="text-sm text-gray-500">系统统计与趋势分析</p>
        </div>
        <button
          onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          {isFullscreen ? '退出全屏' : '全屏'}
        </button>
      </div>

      <div>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              title: '提示词总数',
              value: overview?.total_prompts ?? 0,
              subtitle: `最近7天新增 ${overview?.recent_prompts ?? 0} 个`,
              color: COLORS.primary,
            },
            {
              title: '项目总数',
              value: overview?.total_projects ?? 0,
              subtitle: '已创建项目',
              color: COLORS.secondary,
            },
            {
              title: '版本总数',
              value: overview?.total_versions ?? 0,
              subtitle: `平均 ${versionStats?.avg_versions_per_prompt.toFixed(1) ?? 0} 个/提示词`,
              color: COLORS.success,
            },
            {
              title: '活跃提示词',
              value: versionStats?.prompts_with_versions ?? 0,
              subtitle: '已创建版本',
              color: COLORS.warning,
            },
          ].map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="text-sm font-medium text-gray-500 mb-2">
                {card.title}
              </div>
              <div className="text-3xl font-bold mb-2" style={{ color: card.color }}>
                {card.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">
                {card.subtitle}
              </div>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 趋势图 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">创建趋势</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  fill="url(#areaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 项目分布 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">项目分布</h2>
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="80%"
                data={distribution.slice(0, 6).map((item, index) => ({
                  name: item.name,
                  value: item.count,
                  fill: Object.values(COLORS)[index % Object.values(COLORS).length],
                }))}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="value" cornerRadius={4}>
                  {distribution.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                  ))}
                </RadialBar>
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 最近创建的提示词 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近创建的提示词</h2>
          {recentPrompts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              暂无数据
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="font-medium text-gray-900 mb-1">
                    {prompt.name}
                  </div>
                  <div className="text-xs font-mono text-gray-500 mb-1">
                    {prompt.slug}
                  </div>
                  {prompt.project_name && (
                    <div className="text-xs text-gray-400">
                      {prompt.project_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
