/**
 * 生产环境配置文件
 * Production Environment Configuration
 */

module.exports = {
  // 环境标识
  environment: 'production',
  
  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_APP_ID || 'your_production_app_id',
    appSecret: process.env.WECHAT_APP_SECRET || 'your_production_app_secret',
    
    // 服务器域名配置 (需要在微信公众平台配置)
    serverDomains: {
      request: [
        'https://api.foodiefinder.com',
        'https://ai-api.foodiefinder.com'
      ],
      upload: [
        'https://upload.foodiefinder.com'
      ],
      download: [
        'https://cdn.foodiefinder.com'
      ]
    },
    
    // 业务域名配置
    businessDomains: [
      'https://www.foodiefinder.com'
    ]
  },
  
  // AI服务配置
  aiServices: {
    // 图像识别服务
    vision: {
      provider: 'tencent', // 'tencent' | 'baidu' | 'aliyun'
      apiKey: process.env.AI_VISION_API_KEY || '',
      secretKey: process.env.AI_VISION_SECRET_KEY || '',
      endpoint: process.env.AI_VISION_ENDPOINT || 'https://vision.tencentcloudapi.com',
      region: process.env.AI_VISION_REGION || 'ap-beijing',
      
      // 请求配置
      timeout: 30000,
      retryTimes: 3,
      retryDelay: 1000,
      
      // 识别参数
      confidence: 0.7, // 最低置信度
      maxResults: 5    // 最大返回结果数
    },
    
    // 文本生成服务
    textGeneration: {
      provider: 'tongyi', // 'tongyi' | 'wenxin' | 'chatgpt'
      apiKey: process.env.AI_TEXT_API_KEY || '',
      endpoint: process.env.AI_TEXT_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      model: process.env.AI_TEXT_MODEL || 'qwen-turbo',
      
      // 生成参数
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.8,
      timeout: 60000,
      retryTimes: 2
    }
  },
  
  // 服务器配置
  server: {
    // 主服务器
    api: {
      host: process.env.API_HOST || 'api.foodiefinder.com',
      port: process.env.API_PORT || 443,
      protocol: 'https',
      basePath: '/api/v1'
    },
    
    // CDN配置
    cdn: {
      host: process.env.CDN_HOST || 'cdn.foodiefinder.com',
      protocol: 'https',
      imagePath: '/images',
      staticPath: '/static'
    },
    
    // 数据库配置
    database: {
      type: process.env.DB_TYPE || 'mongodb',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 27017,
      name: process.env.DB_NAME || 'foodiefinder_prod',
      username: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      
      // 连接池配置
      poolSize: 10,
      maxIdleTime: 30000,
      serverSelectionTimeout: 5000
    },
    
    // Redis缓存配置
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: process.env.REDIS_DB || 0,
      keyPrefix: 'foodiefinder:',
      
      // 连接配置
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    }
  },
  
  // 安全配置
  security: {
    // JWT配置
    jwt: {
      secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256'
    },
    
    // 加密配置
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY || 'your_encryption_key'
    },
    
    // CORS配置
    cors: {
      origin: [
        'https://servicewechat.com',
        'https://www.foodiefinder.com'
      ],
      credentials: true,
      maxAge: 86400
    },
    
    // 限流配置
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 1000, // 每个IP最多1000次请求
      message: '请求过于频繁，请稍后再试'
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    
    // 文件日志
    file: {
      enabled: true,
      path: process.env.LOG_PATH || '/var/log/foodiefinder',
      maxSize: '100MB',
      maxFiles: 30,
      datePattern: 'YYYY-MM-DD'
    },
    
    // 远程日志
    remote: {
      enabled: process.env.REMOTE_LOG_ENABLED === 'true',
      endpoint: process.env.REMOTE_LOG_ENDPOINT || '',
      apiKey: process.env.REMOTE_LOG_API_KEY || ''
    }
  },
  
  // 监控配置
  monitoring: {
    // 性能监控
    performance: {
      enabled: true,
      sampleRate: 0.1, // 10%采样率
      endpoint: process.env.MONITORING_ENDPOINT || ''
    },
    
    // 错误监控
    errorTracking: {
      enabled: true,
      dsn: process.env.ERROR_TRACKING_DSN || '',
      environment: 'production'
    },
    
    // 健康检查
    healthCheck: {
      enabled: true,
      interval: 30000, // 30秒
      timeout: 5000,   // 5秒超时
      endpoints: [
        '/health',
        '/api/health'
      ]
    }
  },
  
  // 缓存配置
  cache: {
    // 应用缓存
    app: {
      ttl: 3600, // 1小时
      maxSize: 1000
    },
    
    // API缓存
    api: {
      ttl: 300, // 5分钟
      maxSize: 500
    },
    
    // 图片缓存
    image: {
      ttl: 86400, // 24小时
      maxSize: 100
    }
  },
  
  // 第三方服务配置
  thirdParty: {
    // 短信服务
    sms: {
      provider: process.env.SMS_PROVIDER || 'aliyun',
      accessKey: process.env.SMS_ACCESS_KEY || '',
      secretKey: process.env.SMS_SECRET_KEY || '',
      signName: process.env.SMS_SIGN_NAME || '识食有方',
      templateCode: process.env.SMS_TEMPLATE_CODE || ''
    },
    
    // 邮件服务
    email: {
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      host: process.env.EMAIL_HOST || '',
      port: process.env.EMAIL_PORT || 587,
      username: process.env.EMAIL_USERNAME || '',
      password: process.env.EMAIL_PASSWORD || '',
      from: process.env.EMAIL_FROM || 'noreply@foodiefinder.com'
    },
    
    // 对象存储
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'aliyun',
      accessKey: process.env.STORAGE_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_SECRET_KEY || '',
      bucket: process.env.STORAGE_BUCKET || 'foodiefinder-prod',
      region: process.env.STORAGE_REGION || 'oss-cn-beijing',
      endpoint: process.env.STORAGE_ENDPOINT || ''
    }
  }
};