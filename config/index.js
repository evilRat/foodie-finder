/**
 * 配置管理入口文件
 * Configuration Management Entry Point
 */

const developmentConfig = require('./development');
const productionConfig = require('./production');

// 获取当前环境
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * 根据环境获取配置
 * @returns {Object} 环境配置
 */
function getConfig() {
  switch (NODE_ENV) {
    case 'production':
      return productionConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * 验证必需的环境变量
 * @param {Object} config 配置对象
 * @returns {Array} 缺失的环境变量列表
 */
function validateConfig(config) {
  const missing = [];
  
  // 生产环境必需的环境变量
  if (config.environment === 'production') {
    const requiredVars = [
      'WECHAT_APP_ID',
      'WECHAT_APP_SECRET',
      'AI_VISION_API_KEY',
      'AI_TEXT_API_KEY',
      'JWT_SECRET',
      'ENCRYPTION_KEY'
    ];
    
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });
  }
  
  return missing;
}

/**
 * 初始化配置
 * @returns {Object} 初始化后的配置
 */
function initConfig() {
  const config = getConfig();
  
  // 验证配置
  const missingVars = validateConfig(config);
  if (missingVars.length > 0) {
    console.warn(`警告: 以下环境变量未设置: ${missingVars.join(', ')}`);
    
    // 生产环境缺少必需变量时抛出错误
    if (config.environment === 'production') {
      throw new Error(`生产环境缺少必需的环境变量: ${missingVars.join(', ')}`);
    }
  }
  
  // 添加运行时信息
  config.runtime = {
    nodeVersion: process.version,
    platform: process.platform,
    startTime: new Date().toISOString(),
    pid: process.pid
  };
  
  return config;
}

/**
 * 获取API配置
 * @returns {Object} API配置
 */
function getApiConfig() {
  const config = getConfig();
  return {
    baseURL: `${config.server.api.protocol}://${config.server.api.host}:${config.server.api.port}${config.server.api.basePath}`,
    timeout: config.aiServices.vision.timeout,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FoodieFinder/1.0.0'
    }
  };
}

/**
 * 获取微信小程序配置
 * @returns {Object} 微信小程序配置
 */
function getWechatConfig() {
  const config = getConfig();
  return {
    appId: config.wechat.appId,
    serverDomains: config.wechat.serverDomains,
    businessDomains: config.wechat.businessDomains
  };
}

/**
 * 获取AI服务配置
 * @returns {Object} AI服务配置
 */
function getAiConfig() {
  const config = getConfig();
  return {
    vision: {
      ...config.aiServices.vision,
      // 隐藏敏感信息
      apiKey: config.aiServices.vision.apiKey ? '***' : '',
      secretKey: config.aiServices.vision.secretKey ? '***' : ''
    },
    textGeneration: {
      ...config.aiServices.textGeneration,
      // 隐藏敏感信息
      apiKey: config.aiServices.textGeneration.apiKey ? '***' : ''
    }
  };
}

/**
 * 获取数据库配置
 * @returns {Object} 数据库配置
 */
function getDatabaseConfig() {
  const config = getConfig();
  return {
    ...config.server.database,
    // 隐藏敏感信息
    username: config.server.database.username ? '***' : '',
    password: config.server.database.password ? '***' : ''
  };
}

/**
 * 打印配置信息（隐藏敏感数据）
 */
function printConfig() {
  const config = getConfig();
  
  console.log('='.repeat(50));
  console.log('FoodieFinder 配置信息');
  console.log('='.repeat(50));
  console.log(`环境: ${config.environment}`);
  console.log(`Node.js版本: ${process.version}`);
  console.log(`平台: ${process.platform}`);
  console.log(`进程ID: ${process.pid}`);
  console.log('-'.repeat(50));
  console.log('API服务:');
  console.log(`  地址: ${config.server.api.protocol}://${config.server.api.host}:${config.server.api.port}`);
  console.log(`  基础路径: ${config.server.api.basePath}`);
  console.log('-'.repeat(50));
  console.log('AI服务:');
  console.log(`  图像识别: ${config.aiServices.vision.provider}`);
  console.log(`  文本生成: ${config.aiServices.textGeneration.provider}`);
  console.log('-'.repeat(50));
  console.log('数据库:');
  console.log(`  类型: ${config.server.database.type}`);
  console.log(`  地址: ${config.server.database.host}:${config.server.database.port}`);
  console.log(`  数据库: ${config.server.database.name}`);
  console.log('='.repeat(50));
}

module.exports = {
  getConfig,
  initConfig,
  validateConfig,
  getApiConfig,
  getWechatConfig,
  getAiConfig,
  getDatabaseConfig,
  printConfig,
  
  // 导出环境常量
  NODE_ENV,
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production'
};