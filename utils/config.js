/**
 * 应用配置文件
 * 统一管理应用的配置信息和常量
 */

// 环境配置
const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production'
};

// 当前环境 (可以通过构建工具动态设置)
const CURRENT_ENV = process.env.NODE_ENV === 'production' ? ENV.PRODUCTION : ENV.DEVELOPMENT;

// API配置
const API_CONFIG = {
  [ENV.DEVELOPMENT]: {
    baseURL: 'https://dev-api.foodiefinder.com',
    timeout: 30000
  },
  [ENV.PRODUCTION]: {
    baseURL: 'https://api.foodiefinder.com',
    timeout: 60000
  }
};

// 图片配置
const IMAGE_CONFIG = {
  // 支持的图片格式
  supportedFormats: ['jpg', 'jpeg', 'png'],
  
  // 最大文件大小 (5MB)
  maxFileSize: 5 * 1024 * 1024,
  
  // 压缩配置
  compression: {
    quality: 80,
    maxWidth: 800,
    maxHeight: 600
  },
  
  // 上传配置
  upload: {
    timeout: 60000,
    retryTimes: 3
  }
};

// 菜谱配置
const RECIPE_CONFIG = {
  // 支持的菜系
  cuisines: [
    { value: 'sichuan', label: '川菜' },
    { value: 'cantonese', label: '粤菜' },
    { value: 'shandong', label: '鲁菜' },
    { value: 'jiangsu', label: '苏菜' },
    { value: 'zhejiang', label: '浙菜' },
    { value: 'fujian', label: '闽菜' },
    { value: 'hunan', label: '湘菜' },
    { value: 'anhui', label: '徽菜' }
  ],
  
  // 难度等级
  difficulties: [
    { value: 'easy', label: '简单' },
    { value: 'medium', label: '中等' },
    { value: 'hard', label: '困难' }
  ],
  
  // 生成超时时间
  generationTimeout: 30000
};

// UI配置
const UI_CONFIG = {
  // 加载提示配置
  loading: {
    defaultTitle: '加载中...',
    recognitionTitle: '正在识别食物...',
    generationTitle: '正在生成菜谱...',
    uploadTitle: '正在上传图片...'
  },
  
  // 提示信息配置
  messages: {
    success: {
      recognition: '识别成功',
      generation: '菜谱生成成功',
      upload: '上传成功'
    },
    error: {
      network: '网络连接失败',
      timeout: '请求超时',
      recognition: '识别失败',
      generation: '菜谱生成失败'
    }
  },
  
  // 动画配置
  animation: {
    duration: 300,
    timingFunction: 'ease-in-out'
  }
};

// 缓存配置
const CACHE_CONFIG = {
  // 缓存键名
  keys: {
    searchHistory: 'search_history',
    recentRecipes: 'recent_recipes',
    userPreferences: 'user_preferences'
  },
  
  // 缓存过期时间 (毫秒)
  expiration: {
    searchHistory: 7 * 24 * 60 * 60 * 1000, // 7天
    recentRecipes: 30 * 24 * 60 * 60 * 1000, // 30天
    userPreferences: 365 * 24 * 60 * 60 * 1000 // 1年
  },
  
  // 最大缓存数量
  maxItems: {
    searchHistory: 50,
    recentRecipes: 100
  }
};

// 统计配置
const ANALYTICS_CONFIG = {
  // 事件类型
  events: {
    PAGE_VIEW: 'page_view',
    SEARCH: 'search',
    RECOGNITION: 'recognition',
    RECIPE_GENERATION: 'recipe_generation',
    ERROR: 'error'
  },
  
  // 是否启用统计
  enabled: CURRENT_ENV === ENV.PRODUCTION
};

/**
 * 获取当前环境的API配置
 * @returns {Object} API配置
 */
function getApiConfig() {
  return API_CONFIG[CURRENT_ENV];
}

/**
 * 获取完整配置
 * @returns {Object} 完整配置对象
 */
function getConfig() {
  return {
    env: CURRENT_ENV,
    api: getApiConfig(),
    image: IMAGE_CONFIG,
    recipe: RECIPE_CONFIG,
    ui: UI_CONFIG,
    cache: CACHE_CONFIG,
    analytics: ANALYTICS_CONFIG
  };
}

module.exports = {
  ENV,
  CURRENT_ENV,
  API_CONFIG,
  IMAGE_CONFIG,
  RECIPE_CONFIG,
  UI_CONFIG,
  CACHE_CONFIG,
  ANALYTICS_CONFIG,
  getApiConfig,
  getConfig
};