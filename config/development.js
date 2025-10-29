/**
 * 开发环境配置文件
 * Development Environment Configuration
 */

module.exports = {
  // 环境标识
  environment: 'development',
  
  // 微信小程序配置
  wechat: {
    appId: process.env.WECHAT_DEV_APP_ID || 'your_development_app_id',
    appSecret: process.env.WECHAT_DEV_APP_SECRET || 'your_development_app_secret',
    
    // 开发服务器域名配置
    serverDomains: {
      request: [
        'https://dev-api.foodiefinder.com',
        'http://localhost:3000'
      ],
      upload: [
        'https://dev-upload.foodiefinder.com',
        'http://localhost:3000'
      ],
      download: [
        'https://dev-cdn.foodiefinder.com',
        'http://localhost:3000'
      ]
    },
    
    // 业务域名配置
    businessDomains: [
      'https://dev.foodiefinder.com',
      'http://localhost:8080'
    ]
  },
  
  // AI服务配置
  aiServices: {
    // 图像识别服务
    vision: {
      provider: 'tencent',
      apiKey: process.env.AI_VISION_DEV_API_KEY || '',
      secretKey: process.env.AI_VISION_DEV_SECRET_KEY || '',
      endpoint: process.env.AI_VISION_DEV_ENDPOINT || 'https://vision.tencentcloudapi.com',
      region: process.env.AI_VISION_DEV_REGION || 'ap-beijing',
      
      // 开发环境使用较短的超时时间
      timeout: 15000,
      retryTimes: 2,
      retryDelay: 500,
      
      // 识别参数
      confidence: 0.5, // 开发环境使用较低的置信度
      maxResults: 3
    },
    
    // 文本生成服务
    textGeneration: {
      provider: 'tongyi',
      apiKey: process.env.AI_TEXT_DEV_API_KEY || '',
      endpoint: process.env.AI_TEXT_DEV_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      model: process.env.AI_TEXT_DEV_MODEL || 'qwen-turbo',
      
      // 开发环境生成参数
      maxTokens: 1000,
      temperature: 0.8,
      topP: 0.9,
      timeout: 30000,
      retryTimes: 1
    }
  },
  
  // 服务器配置
  server: {
    // 开发服务器
    api: {
      host: process.env.DEV_API_HOST || 'localhost',
      port: process.env.DEV_API_PORT || 3000,
      protocol: 'http',
      basePath: '/api/v1'
    },
    
    // 本地CDN配置
    cdn: {
      host: process.env.DEV_CDN_HOST || 'localhost:3000',
      protocol: 'http',
      imagePath: '/uploads/images',
      staticPath: '/static'
    },
    
    // 开发数据库配置
    database: {
      type: process.env.DEV_DB_TYPE || 'mongodb',
      host: process.env.DEV_DB_HOST || 'localhost',
      port: process.env.DEV_DB_PORT || 27017,
      name: process.env.DEV_DB_NAME || 'foodiefinder_dev',
      username: process.env.DEV_DB_USERNAME || '',
      password: process.env.DEV_DB_PASSWORD || '',
      ssl: false,
      
      // 开发环境连接池配置
      poolSize: 5,
      maxIdleTime: 10000,
      serverSelectionTimeout: 3000
    },
    
    // 开发Redis配置
    redis: {
      host: process.env.DEV_REDIS_HOST || 'localhost',
      port: process.env.DEV_REDIS_PORT || 6379,
      password: process.env.DEV_REDIS_PASSWORD || '',
      db: process.env.DEV_REDIS_DB || 1,
      keyPrefix: 'foodiefinder:dev:',
      
      // 开发环境连接配置
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 2
    }
  },
  
  // 安全配置（开发环境相对宽松）
  security: {
    // JWT配置
    jwt: {
      secret: process.env.DEV_JWT_SECRET || 'dev_jwt_secret_key',
      expiresIn: process.env.DEV_JWT_EXPIRES_IN || '24h',
      algorithm: 'HS256'
    },
    
    // 加密配置
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.DEV_ENCRYPTION_KEY || 'dev_encryption_key'
    },
    
    // CORS配置（开发环境允许所有来源）
    cors: {
      origin: true,
      credentials: true,
      maxAge: 3600
    },
    
    // 限流配置（开发环境较宽松）
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 10000,
      message: '请求过于频繁，请稍后再试'
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.DEV_LOG_LEVEL || 'debug',
    format: 'simple',
    
    // 控制台日志
    console: {
      enabled: true,
      colorize: true
    },
    
    // 文件日志（开发环境可选）
    file: {
      enabled: false,
      path: './logs',
      maxSize: '10MB',
      maxFiles: 5
    },
    
    // 远程日志（开发环境禁用）
    remote: {
      enabled: false
    }
  },
  
  // 监控配置（开发环境简化）
  monitoring: {
    // 性能监控
    performance: {
      enabled: false,
      sampleRate: 1.0
    },
    
    // 错误监控
    errorTracking: {
      enabled: false,
      environment: 'development'
    },
    
    // 健康检查
    healthCheck: {
      enabled: true,
      interval: 60000,
      timeout: 3000,
      endpoints: [
        '/health'
      ]
    }
  },
  
  // 缓存配置（开发环境较短TTL）
  cache: {
    // 应用缓存
    app: {
      ttl: 300, // 5分钟
      maxSize: 100
    },
    
    // API缓存
    api: {
      ttl: 60, // 1分钟
      maxSize: 50
    },
    
    // 图片缓存
    image: {
      ttl: 3600, // 1小时
      maxSize: 20
    }
  },
  
  // 第三方服务配置（开发环境使用测试账号）
  thirdParty: {
    // 短信服务（开发环境禁用或使用测试）
    sms: {
      provider: 'mock',
      enabled: false
    },
    
    // 邮件服务（开发环境使用测试邮箱）
    email: {
      provider: 'smtp',
      host: process.env.DEV_EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.DEV_EMAIL_PORT || 587,
      username: process.env.DEV_EMAIL_USERNAME || '',
      password: process.env.DEV_EMAIL_PASSWORD || '',
      from: process.env.DEV_EMAIL_FROM || 'dev@foodiefinder.com'
    },
    
    // 对象存储（开发环境使用本地存储或测试bucket）
    storage: {
      provider: 'local',
      path: './uploads',
      baseUrl: 'http://localhost:3000/uploads'
    }
  },
  
  // 开发工具配置
  devTools: {
    // 热重载
    hotReload: {
      enabled: true,
      port: 3001
    },
    
    // 调试模式
    debug: {
      enabled: true,
      verbose: true
    },
    
    // Mock数据
    mock: {
      enabled: process.env.ENABLE_MOCK === 'true',
      delay: 1000 // 模拟网络延迟
    }
  }
};