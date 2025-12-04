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

