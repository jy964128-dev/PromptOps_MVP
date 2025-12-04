/**
 * 数据大屏组件 - 高端科技感设计
 * Light Mode, Glassmorphism, Bento Grid, Cyberpunk Purple & Neon Blue gradients
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
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

// 赛博朋克紫色和霓虹蓝渐变配色
const CYBERPUNK_PURPLE = '#8B5CF6';
const NEON_BLUE = '#00D4FF';
const GRADIENT_COLORS = [
  { start: '#8B5CF6', end: '#A855F7' }, // Purple
  { start: '#00D4FF', end: '#0099FF' }, // Neon Blue
  { start: '#A855F7', end: '#00D4FF' }, // Purple to Blue
  { start: '#6366F1', end: '#8B5CF6' }, // Indigo to Purple
];

// 南丁格尔玫瑰图颜色（全息纹理效果）
const ROSE_COLORS = [
  'url(#holographic1)',
  'url(#holographic2)',
  'url(#holographic3)',
  'url(#holographic4)',
  'url(#holographic5)',
  'url(#holographic6)',
];

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

  // 生成小型折线图数据（Sparklines）
  const generateSparklineData = (value: number) => {
    const data = [];
    for (let i = 0; i < 10; i++) {
      data.push({ value: value + Math.random() * 5 - 2.5 });
    }
    return data;
  };

  // 准备南丁格尔玫瑰图数据
  const roseChartData = distribution.slice(0, 6).map((item, index) => ({
    name: item.name,
    value: item.count,
    fill: ROSE_COLORS[index % ROSE_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#F5F7FA' }}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div className="text-lg font-semibold" style={{ color: '#374151' }}>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dashboardRef}
      className={`min-h-screen relative overflow-hidden ${isFullscreen ? 'h-screen p-4' : 'p-6'}`}
      style={{ background: '#F5F7FA' }}
    >
      {/* SVG 渐变定义 - 全息纹理效果 */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* 赛博朋克紫色到霓虹蓝渐变 */}
          <linearGradient id="cyberpunkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={CYBERPUNK_PURPLE} stopOpacity={1} />
            <stop offset="100%" stopColor={NEON_BLUE} stopOpacity={1} />
          </linearGradient>
          
          {/* 全息纹理渐变 1-6 */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <linearGradient key={i} id={`holographic${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.8} />
              <stop offset="50%" stopColor={NEON_BLUE} stopOpacity={0.9} />
              <stop offset="100%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.8} />
            </linearGradient>
          ))}
          
          {/* Streamgraph 渐变 */}
          <linearGradient id="streamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.6} />
            <stop offset="50%" stopColor={NEON_BLUE} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.2} />
          </linearGradient>
        </defs>
      </svg>

      {/* 浮动装饰元素 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-20 right-20 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{
            background: `linear-gradient(135deg, ${CYBERPUNK_PURPLE}, ${NEON_BLUE})`,
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-20 left-20 w-96 h-96 rounded-full opacity-5 blur-3xl"
          style={{
            background: `linear-gradient(135deg, ${NEON_BLUE}, ${CYBERPUNK_PURPLE})`,
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* 标题栏 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1
              className="text-5xl font-black mb-2"
              style={{
                background: `linear-gradient(135deg, ${CYBERPUNK_PURPLE}, ${NEON_BLUE})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              数据大屏
            </h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              PromptOps 系统实时数据监控
            </p>
          </div>
          <button
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              color: '#374151',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }}
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>

        {/* Bento Grid 布局 */}
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧 KPI 卡片 - 大号粗体数字 + Sparklines */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {[
              {
                title: '提示词总数',
                value: overview?.total_prompts ?? 0,
                subtitle: `最近7天新增 ${overview?.recent_prompts ?? 0} 个`,
                gradient: GRADIENT_COLORS[0],
              },
              {
                title: '项目总数',
                value: overview?.total_projects ?? 0,
                subtitle: '已创建项目',
                gradient: GRADIENT_COLORS[1],
              },
              {
                title: '版本总数',
                value: overview?.total_versions ?? 0,
                subtitle: `平均 ${versionStats?.avg_versions_per_prompt.toFixed(1) ?? 0} 个/提示词`,
                gradient: GRADIENT_COLORS[2],
              },
              {
                title: '活跃提示词',
                value: versionStats?.prompts_with_versions ?? 0,
                subtitle: '已创建版本',
                gradient: GRADIENT_COLORS[3],
              },
            ].map((card, index) => (
              <div
                key={index}
                className="rounded-2xl p-6 transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                  boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
                }}
              >
                <div className="text-sm font-semibold mb-3" style={{ color: '#6B7280' }}>
                  {card.title}
                </div>
                <div
                  className="text-5xl font-black mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${card.gradient.start}, ${card.gradient.end})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {card.value.toLocaleString()}
                </div>
                <div className="text-xs mb-3" style={{ color: '#9CA3AF' }}>
                  {card.subtitle}
                </div>
                {/* Sparkline 小型折线图 */}
                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateSparklineData(card.value)}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={`url(#cyberpunkGradient)`}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* 中心英雄元素 - Streamgraph 面积图 */}
          <div className="col-span-12 lg:col-span-6">
            <div
              className="rounded-2xl p-8 h-full"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
              }}
            >
              <h2 className="text-xl font-bold mb-6" style={{ color: '#374151' }}>
                用户流量趋势
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="streamGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.6} />
                      <stop offset="50%" stopColor={NEON_BLUE} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CYBERPUNK_PURPLE} stopOpacity={0.2} />
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
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${CYBERPUNK_PURPLE}`,
                      borderRadius: '12px',
                      color: '#374151',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={`url(#cyberpunkGradient)`}
                    strokeWidth={3}
                    fill="url(#streamGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 右侧 - 南丁格尔玫瑰图 */}
          <div className="col-span-12 lg:col-span-3">
            <div
              className="rounded-2xl p-8 h-full"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
              }}
            >
              <h2 className="text-xl font-bold mb-6" style={{ color: '#374151' }}>
                项目分布
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="90%"
                  data={roseChartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={8}
                    fill={(entry: any) => entry.fill}
                  >
                    {roseChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </RadialBar>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${CYBERPUNK_PURPLE}`,
                      borderRadius: '12px',
                      color: '#374151',
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 底部 - 最近创建的提示词 */}
          <div className="col-span-12">
            <div
              className="rounded-2xl p-8"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.1)',
              }}
            >
              <h2 className="text-xl font-bold mb-6" style={{ color: '#374151' }}>
                最近创建的提示词
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentPrompts.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>
                    暂无数据
                  </div>
                ) : (
                  recentPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="p-4 rounded-xl transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(255, 255, 255, 0.5)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(139, 92, 246, 0.1)',
                      }}
                    >
                      <div className="font-semibold mb-2" style={{ color: '#374151' }}>
                        {prompt.name}
                      </div>
                      <div className="text-xs mb-2 font-mono" style={{ color: '#6B7280' }}>
                        {prompt.slug}
                      </div>
                      {prompt.project_name && (
                        <div className="text-xs" style={{ color: '#9CA3AF' }}>
                          {prompt.project_name}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 添加浮动动画样式 */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
