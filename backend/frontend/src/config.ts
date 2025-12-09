/**
 * 应用配置文件
 * 支持环境变量配置
 */

// API 基础地址，优先使用环境变量，否则使用默认值
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

// 应用配置
export const APP_CONFIG = {
  apiBase: API_BASE,
  // 其他配置可以在这里添加
};

// 在开发环境下输出配置信息
if (import.meta.env.DEV) {
  console.log('🔧 API 配置信息:');
  console.log('  - API_BASE:', API_BASE);
  console.log('  - VITE_API_BASE (环境变量):', import.meta.env.VITE_API_BASE || '(未设置)');
  console.log('  - 当前环境:', import.meta.env.MODE);
}

// 测试 API 连接
export async function testAPIConnection(): Promise<{ success: boolean; message: string; url: string }> {
  const healthUrl = `${API_BASE}/health`;
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `连接成功: ${JSON.stringify(data)}`,
        url: healthUrl,
      };
    } else {
      return {
        success: false,
        message: `连接失败: HTTP ${response.status} ${response.statusText}`,
        url: healthUrl,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `连接错误: ${error.message}`,
      url: healthUrl,
    };
  }
}

