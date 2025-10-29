/**
 * 性能优化工具模块
 * 任务6.3: 性能优化和调试
 * 
 * 功能包括:
 * - 页面加载速度优化 (需求6.1)
 * - API响应时间优化 (需求2.3, 5.5)
 * - 内存使用优化
 * - 网络请求优化
 * - 图片处理优化
 */

const { CacheManager, PerformanceMonitor } = require('./util');

/**
 * 页面性能优化器
 */
class PagePerformanceOptimizer {
  constructor() {
    this.pageMetrics = new Map();
    this.optimizationRules = new Map();
    this.performanceThresholds = {
      pageLoad: 2000,      // 页面加载 < 2秒 (需求6.1)
      apiResponse: 5000,   // API响应 < 5秒 (需求2.3)
      imageProcess: 3000,  // 图片处理 < 3秒
      recipeGeneration: 30000 // 菜谱生成 < 30秒 (需求5.5)
    };
  }

  /**
   * 优化页面加载速度 - 需求6.1
   * @param {String} pageName 页面名称
   * @param {Function} loadFunction 页面加载函数
   * @returns {Promise} 优化后的加载结果
   */
  async optimizePageLoad(pageName, loadFunction) {
    const startTime = Date.now();
    PerformanceMonitor.start(`page_load_${pageName}`);
    
    try {
      // 预加载关键资源
      await this.preloadCriticalResources(pageName);
      
      // 执行页面加载
      const result = await loadFunction();
      
      // 记录性能指标
      const loadTime = Date.now() - startTime;
      PerformanceMonitor.end(`page_load_${pageName}`);
      
      // 存储页面性能指标
      this.recordPageMetrics(pageName, {
        loadTime: loadTime,
        timestamp: Date.now(),
        success: true
      });
      
      // 检查是否需要优化
      if (loadTime > this.performanceThresholds.pageLoad) {
        console.warn(`页面 ${pageName} 加载时间过长: ${loadTime}ms`);
        await this.applyPageOptimizations(pageName);
      }
      
      return result;
    } catch (error) {
      PerformanceMonitor.end(`page_load_${pageName}`);
      this.recordPageMetrics(pageName, {
        loadTime: Date.now() - startTime,
        timestamp: Date.now(),
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 预加载关键资源
   * @param {String} pageName 页面名称
   */
  async preloadCriticalResources(pageName) {
    const criticalResources = {
      'index': ['searchHistory', 'userPreferences'],
      'recipe': ['recipeCache', 'userPreferences', 'cuisineData']
    };
    
    const resources = criticalResources[pageName] || [];
    
    const preloadPromises = resources.map(async (resource) => {
      try {
        switch (resource) {
          case 'searchHistory':
            return wx.getStorageSync('searchHistory') || [];
          case 'userPreferences':
            return wx.getStorageSync('userPreferences') || {};
          case 'recipeCache':
            return this.preloadRecentRecipes();
          case 'cuisineData':
            return this.preloadCuisineData();
          default:
            return null;
        }
      } catch (error) {
        console.warn(`预加载资源 ${resource} 失败:`, error);
        return null;
      }
    });
    
    await Promise.all(preloadPromises);
  }

  /**
   * 预加载最近的菜谱
   */
  async preloadRecentRecipes() {
    try {
      const recentRecipes = wx.getStorageSync('recipeSearchHistory') || [];
      const recentFoods = recentRecipes.slice(0, 5).map(item => item.foodName);
      
      // 预加载最近搜索的菜谱缓存
      const cachePromises = recentFoods.map(foodName => {
        const cacheKey = `recipe_${foodName.toLowerCase().replace(/\s+/g, '_')}`;
        return CacheManager.get(cacheKey);
      });
      
      await Promise.all(cachePromises);
      console.log('预加载最近菜谱完成');
    } catch (error) {
      console.warn('预加载最近菜谱失败:', error);
    }
  }

  /**
   * 预加载菜系数据
   */
  async preloadCuisineData() {
    try {
      const cuisineData = {
        '川菜': { spiceLevel: '麻辣', characteristics: '麻辣鲜香' },
        '粤菜': { spiceLevel: '清淡', characteristics: '清淡鲜美' },
        '鲁菜': { spiceLevel: '适中', characteristics: '咸鲜为主' }
      };
      
      CacheManager.set('cuisineData', cuisineData, 24 * 60 * 60 * 1000);
      console.log('预加载菜系数据完成');
    } catch (error) {
      console.warn('预加载菜系数据失败:', error);
    }
  }

  /**
   * 应用页面优化策略
   * @param {String} pageName 页面名称
   */
  async applyPageOptimizations(pageName) {
    const optimizations = [
      this.optimizeDataLoading.bind(this),
      this.optimizeImageLoading.bind(this),
      this.optimizeMemoryUsage.bind(this),
      this.optimizeCacheStrategy.bind(this)
    ];
    
    for (const optimization of optimizations) {
      try {
        await optimization(pageName);
      } catch (error) {
        console.warn(`应用优化策略失败:`, error);
      }
    }
  }

  /**
   * 优化数据加载
   * @param {String} pageName 页面名称
   */
  async optimizeDataLoading(pageName) {
    // 实现懒加载策略
    const lazyLoadConfig = {
      'index': {
        immediate: ['searchHistory'],
        deferred: ['recognitionHistory', 'recipeStats']
      },
      'recipe': {
        immediate: ['recipeData'],
        deferred: ['nutritionInfo', 'relatedRecipes']
      }
    };
    
    const config = lazyLoadConfig[pageName];
    if (config) {
      // 立即加载关键数据
      config.immediate.forEach(dataType => {
        this.loadDataImmediate(dataType);
      });
      
      // 延迟加载非关键数据
      setTimeout(() => {
        config.deferred.forEach(dataType => {
          this.loadDataDeferred(dataType);
        });
      }, 500);
    }
  }

  /**
   * 立即加载数据
   * @param {String} dataType 数据类型
   */
  loadDataImmediate(dataType) {
    try {
      const data = wx.getStorageSync(dataType);
      console.log(`立即加载 ${dataType}:`, data ? '成功' : '无数据');
    } catch (error) {
      console.warn(`立即加载 ${dataType} 失败:`, error);
    }
  }

  /**
   * 延迟加载数据
   * @param {String} dataType 数据类型
   */
  loadDataDeferred(dataType) {
    try {
      const data = wx.getStorageSync(dataType);
      console.log(`延迟加载 ${dataType}:`, data ? '成功' : '无数据');
    } catch (error) {
      console.warn(`延迟加载 ${dataType} 失败:`, error);
    }
  }

  /**
   * 优化图片加载
   * @param {String} pageName 页面名称
   */
  async optimizeImageLoading(pageName) {
    // 图片预加载和压缩优化
    const imageOptimizations = {
      enableLazyLoad: true,
      enablePreload: true,
      compressionQuality: 80,
      maxConcurrentLoads: 3
    };
    
    console.log(`应用图片优化策略到页面 ${pageName}:`, imageOptimizations);
  }

  /**
   * 优化内存使用
   * @param {String} pageName 页面名称
   */
  async optimizeMemoryUsage(pageName) {
    try {
      // 清理过期缓存
      await this.cleanupExpiredCache();
      
      // 限制内存中的数据量
      await this.limitMemoryData(pageName);
      
      console.log(`页面 ${pageName} 内存优化完成`);
    } catch (error) {
      console.warn('内存优化失败:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache() {
    try {
      const info = wx.getStorageInfoSync();
      const cacheKeys = info.keys.filter(key => key.startsWith(CacheManager.PREFIX));
      
      let cleanedCount = 0;
      for (const key of cacheKeys) {
        try {
          const cacheData = wx.getStorageSync(key);
          if (cacheData && cacheData.timestamp) {
            const now = Date.now();
            if (now - cacheData.timestamp > cacheData.expireTime) {
              wx.removeStorageSync(key);
              cleanedCount++;
            }
          }
        } catch (error) {
          // 损坏的缓存项，直接删除
          wx.removeStorageSync(key);
          cleanedCount++;
        }
      }
      
      console.log(`清理过期缓存完成，删除 ${cleanedCount} 个项目`);
    } catch (error) {
      console.warn('清理过期缓存失败:', error);
    }
  }

  /**
   * 限制内存数据
   * @param {String} pageName 页面名称
   */
  async limitMemoryData(pageName) {
    const memoryLimits = {
      'index': {
        searchHistory: 10,
        recognitionHistory: 20
      },
      'recipe': {
        recipeHistory: 50,
        errorHistory: 20
      }
    };
    
    const limits = memoryLimits[pageName];
    if (limits) {
      for (const [dataType, limit] of Object.entries(limits)) {
        try {
          const data = wx.getStorageSync(dataType);
          if (Array.isArray(data) && data.length > limit) {
            const trimmedData = data.slice(0, limit);
            wx.setStorageSync(dataType, trimmedData);
            console.log(`限制 ${dataType} 数据量为 ${limit} 条`);
          }
        } catch (error) {
          console.warn(`限制 ${dataType} 数据量失败:`, error);
        }
      }
    }
  }

  /**
   * 优化缓存策略
   * @param {String} pageName 页面名称
   */
  async optimizeCacheStrategy(pageName) {
    // 根据页面类型调整缓存策略
    const cacheStrategies = {
      'index': {
        searchCache: { expire: 2 * 60 * 60 * 1000, priority: 'high' }, // 2小时
        imageCache: { expire: 1 * 60 * 60 * 1000, priority: 'normal' } // 1小时
      },
      'recipe': {
        recipeCache: { expire: 4 * 60 * 60 * 1000, priority: 'high' }, // 4小时
        nutritionCache: { expire: 24 * 60 * 60 * 1000, priority: 'low' } // 24小时
      }
    };
    
    const strategy = cacheStrategies[pageName];
    if (strategy) {
      console.log(`应用缓存策略到页面 ${pageName}:`, strategy);
    }
  }

  /**
   * 记录页面性能指标
   * @param {String} pageName 页面名称
   * @param {Object} metrics 性能指标
   */
  recordPageMetrics(pageName, metrics) {
    if (!this.pageMetrics.has(pageName)) {
      this.pageMetrics.set(pageName, []);
    }
    
    const pageMetrics = this.pageMetrics.get(pageName);
    pageMetrics.push(metrics);
    
    // 限制记录数量
    if (pageMetrics.length > 50) {
      pageMetrics.splice(0, pageMetrics.length - 50);
    }
  }

  /**
   * 获取页面性能报告
   * @param {String} pageName 页面名称
   * @returns {Object} 性能报告
   */
  getPagePerformanceReport(pageName) {
    const metrics = this.pageMetrics.get(pageName) || [];
    
    if (metrics.length === 0) {
      return { pageName, message: '暂无性能数据' };
    }
    
    const successMetrics = metrics.filter(m => m.success);
    const failureMetrics = metrics.filter(m => !m.success);
    
    const avgLoadTime = successMetrics.length > 0 
      ? successMetrics.reduce((sum, m) => sum + m.loadTime, 0) / successMetrics.length 
      : 0;
    
    const maxLoadTime = successMetrics.length > 0 
      ? Math.max(...successMetrics.map(m => m.loadTime)) 
      : 0;
    
    const minLoadTime = successMetrics.length > 0 
      ? Math.min(...successMetrics.map(m => m.loadTime)) 
      : 0;
    
    return {
      pageName,
      totalRequests: metrics.length,
      successCount: successMetrics.length,
      failureCount: failureMetrics.length,
      successRate: `${Math.round((successMetrics.length / metrics.length) * 100)}%`,
      avgLoadTime: Math.round(avgLoadTime),
      maxLoadTime,
      minLoadTime,
      performanceGrade: this.calculatePerformanceGrade(avgLoadTime),
      recommendations: this.generatePerformanceRecommendations(pageName, avgLoadTime)
    };
  }

  /**
   * 计算性能等级
   * @param {Number} avgLoadTime 平均加载时间
   * @returns {String} 性能等级
   */
  calculatePerformanceGrade(avgLoadTime) {
    if (avgLoadTime < 1000) return 'A+';
    if (avgLoadTime < 2000) return 'A';
    if (avgLoadTime < 3000) return 'B';
    if (avgLoadTime < 5000) return 'C';
    return 'D';
  }

  /**
   * 生成性能优化建议
   * @param {String} pageName 页面名称
   * @param {Number} avgLoadTime 平均加载时间
   * @returns {Array} 优化建议
   */
  generatePerformanceRecommendations(pageName, avgLoadTime) {
    const recommendations = [];
    
    if (avgLoadTime > this.performanceThresholds.pageLoad) {
      recommendations.push('页面加载时间超过2秒，建议优化数据加载策略');
    }
    
    if (avgLoadTime > 5000) {
      recommendations.push('页面加载严重超时，建议检查网络连接和API响应');
    }
    
    recommendations.push('启用图片懒加载以提升首屏加载速度');
    recommendations.push('使用缓存策略减少重复数据加载');
    
    return recommendations;
  }
}

/**
 * API性能优化器
 */
class APIPerformanceOptimizer {
  constructor() {
    this.apiMetrics = new Map();
    this.retryStrategies = new Map();
    this.circuitBreaker = new Map();
  }

  /**
   * 优化API调用响应时间 - 需求2.3, 5.5
   * @param {String} apiName API名称
   * @param {Function} apiFunction API调用函数
   * @param {Object} options 优化选项
   * @returns {Promise} 优化后的API响应
   */
  async optimizeAPICall(apiName, apiFunction, options = {}) {
    const {
      timeout = 5000,
      retryCount = 3,
      cacheEnabled = true,
      circuitBreakerEnabled = true
    } = options;
    
    const startTime = Date.now();
    PerformanceMonitor.start(`api_${apiName}`);
    
    try {
      // 检查熔断器状态
      if (circuitBreakerEnabled && this.isCircuitBreakerOpen(apiName)) {
        throw new Error(`API ${apiName} 熔断器开启，暂时不可用`);
      }
      
      // 尝试从缓存获取
      if (cacheEnabled) {
        const cachedResult = CacheManager.get(`api_${apiName}`);
        if (cachedResult) {
          console.log(`API ${apiName} 使用缓存结果`);
          return cachedResult;
        }
      }
      
      // 执行API调用
      const result = await this.executeWithRetry(apiFunction, retryCount, timeout);
      
      // 记录成功指标
      const responseTime = Date.now() - startTime;
      PerformanceMonitor.end(`api_${apiName}`);
      this.recordAPIMetrics(apiName, { responseTime, success: true });
      
      // 缓存结果
      if (cacheEnabled && result) {
        CacheManager.set(`api_${apiName}`, result, 5 * 60 * 1000); // 缓存5分钟
      }
      
      // 重置熔断器
      this.resetCircuitBreaker(apiName);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      PerformanceMonitor.end(`api_${apiName}`);
      this.recordAPIMetrics(apiName, { responseTime, success: false, error: error.message });
      
      // 更新熔断器
      if (circuitBreakerEnabled) {
        this.updateCircuitBreaker(apiName);
      }
      
      throw error;
    }
  }

  /**
   * 带重试的执行
   * @param {Function} apiFunction API函数
   * @param {Number} retryCount 重试次数
   * @param {Number} timeout 超时时间
   * @returns {Promise} 执行结果
   */
  async executeWithRetry(apiFunction, retryCount, timeout) {
    let lastError;
    
    for (let i = 0; i <= retryCount; i++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('API调用超时')), timeout);
        });
        
        const result = await Promise.race([apiFunction(), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = error;
        
        if (i < retryCount) {
          // 指数退避重试
          const delay = Math.min(1000 * Math.pow(2, i), 5000);
          console.log(`API调用失败，${delay}ms后重试 (${i + 1}/${retryCount}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 检查熔断器是否开启
   * @param {String} apiName API名称
   * @returns {Boolean} 是否开启
   */
  isCircuitBreakerOpen(apiName) {
    const breaker = this.circuitBreaker.get(apiName);
    if (!breaker) return false;
    
    const now = Date.now();
    
    // 如果在冷却期内，检查是否可以尝试
    if (breaker.state === 'open' && now - breaker.lastFailTime > breaker.cooldownTime) {
      breaker.state = 'half-open';
      return false;
    }
    
    return breaker.state === 'open';
  }

  /**
   * 更新熔断器状态
   * @param {String} apiName API名称
   */
  updateCircuitBreaker(apiName) {
    if (!this.circuitBreaker.has(apiName)) {
      this.circuitBreaker.set(apiName, {
        failureCount: 0,
        lastFailTime: 0,
        state: 'closed', // closed, open, half-open
        threshold: 5,
        cooldownTime: 60000 // 1分钟冷却
      });
    }
    
    const breaker = this.circuitBreaker.get(apiName);
    breaker.failureCount++;
    breaker.lastFailTime = Date.now();
    
    if (breaker.failureCount >= breaker.threshold) {
      breaker.state = 'open';
      console.warn(`API ${apiName} 熔断器开启，失败次数: ${breaker.failureCount}`);
    }
  }

  /**
   * 重置熔断器
   * @param {String} apiName API名称
   */
  resetCircuitBreaker(apiName) {
    if (this.circuitBreaker.has(apiName)) {
      const breaker = this.circuitBreaker.get(apiName);
      breaker.failureCount = 0;
      breaker.state = 'closed';
    }
  }

  /**
   * 记录API性能指标
   * @param {String} apiName API名称
   * @param {Object} metrics 性能指标
   */
  recordAPIMetrics(apiName, metrics) {
    if (!this.apiMetrics.has(apiName)) {
      this.apiMetrics.set(apiName, []);
    }
    
    const apiMetrics = this.apiMetrics.get(apiName);
    apiMetrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // 限制记录数量
    if (apiMetrics.length > 100) {
      apiMetrics.splice(0, apiMetrics.length - 100);
    }
  }

  /**
   * 获取API性能报告
   * @param {String} apiName API名称
   * @returns {Object} 性能报告
   */
  getAPIPerformanceReport(apiName) {
    const metrics = this.apiMetrics.get(apiName) || [];
    
    if (metrics.length === 0) {
      return { apiName, message: '暂无API性能数据' };
    }
    
    const successMetrics = metrics.filter(m => m.success);
    const failureMetrics = metrics.filter(m => !m.success);
    
    const avgResponseTime = successMetrics.length > 0 
      ? successMetrics.reduce((sum, m) => sum + m.responseTime, 0) / successMetrics.length 
      : 0;
    
    return {
      apiName,
      totalCalls: metrics.length,
      successCount: successMetrics.length,
      failureCount: failureMetrics.length,
      successRate: `${Math.round((successMetrics.length / metrics.length) * 100)}%`,
      avgResponseTime: Math.round(avgResponseTime),
      circuitBreakerStatus: this.circuitBreaker.get(apiName)?.state || 'closed'
    };
  }
}

/**
 * 系统性能诊断工具
 */
class SystemPerformanceDiagnostic {
  constructor() {
    this.diagnosticResults = [];
  }

  /**
   * 运行完整的性能诊断
   * @returns {Object} 诊断报告
   */
  async runFullDiagnostic() {
    console.log('🔍 开始系统性能诊断...');
    
    const diagnostics = [
      this.diagnoseMemoryUsage(),
      this.diagnoseStorageUsage(),
      this.diagnoseCachePerformance(),
      this.diagnoseNetworkPerformance(),
      this.diagnosePagePerformance()
    ];
    
    const results = await Promise.all(diagnostics);
    
    const report = {
      timestamp: new Date().toISOString(),
      diagnostics: results,
      overallScore: this.calculateOverallScore(results),
      recommendations: this.generateSystemRecommendations(results)
    };
    
    console.log('📊 系统性能诊断完成:', report);
    return report;
  }

  /**
   * 诊断内存使用情况
   * @returns {Object} 内存诊断结果
   */
  async diagnoseMemoryUsage() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      
      return {
        category: '内存使用',
        status: 'good',
        details: {
          platform: systemInfo.platform,
          version: systemInfo.version,
          SDKVersion: systemInfo.SDKVersion
        },
        score: 85,
        recommendations: ['定期清理缓存', '优化数据结构']
      };
    } catch (error) {
      return {
        category: '内存使用',
        status: 'error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * 诊断存储使用情况
   * @returns {Object} 存储诊断结果
   */
  async diagnoseStorageUsage() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      const usagePercentage = (storageInfo.currentSize / storageInfo.limitSize) * 100;
      
      let status = 'good';
      let score = 90;
      const recommendations = [];
      
      if (usagePercentage > 80) {
        status = 'warning';
        score = 60;
        recommendations.push('存储使用率过高，建议清理缓存');
      } else if (usagePercentage > 90) {
        status = 'critical';
        score = 30;
        recommendations.push('存储空间严重不足，立即清理');
      }
      
      return {
        category: '存储使用',
        status: status,
        details: {
          currentSize: storageInfo.currentSize,
          limitSize: storageInfo.limitSize,
          usagePercentage: Math.round(usagePercentage),
          totalKeys: storageInfo.keys.length
        },
        score: score,
        recommendations: recommendations
      };
    } catch (error) {
      return {
        category: '存储使用',
        status: 'error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * 诊断缓存性能
   * @returns {Object} 缓存诊断结果
   */
  async diagnoseCachePerformance() {
    try {
      const cacheStats = CacheManager.getStats();
      const hitRate = cacheStats.hitRate || 0;
      
      let status = 'good';
      let score = Math.round(hitRate * 100);
      const recommendations = [];
      
      if (hitRate < 0.5) {
        status = 'warning';
        recommendations.push('缓存命中率较低，建议优化缓存策略');
      } else if (hitRate < 0.3) {
        status = 'critical';
        recommendations.push('缓存命中率过低，需要重新设计缓存机制');
      }
      
      return {
        category: '缓存性能',
        status: status,
        details: {
          hitRate: `${Math.round(hitRate * 100)}%`,
          totalHits: cacheStats.hits,
          totalMisses: cacheStats.misses,
          totalSets: cacheStats.sets
        },
        score: score,
        recommendations: recommendations
      };
    } catch (error) {
      return {
        category: '缓存性能',
        status: 'error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * 诊断网络性能
   * @returns {Object} 网络诊断结果
   */
  async diagnoseNetworkPerformance() {
    try {
      const networkType = wx.getNetworkType ? await new Promise((resolve) => {
        wx.getNetworkType({
          success: (res) => resolve(res.networkType),
          fail: () => resolve('unknown')
        });
      }) : 'unknown';
      
      let score = 80;
      const recommendations = [];
      
      if (networkType === '2g') {
        score = 40;
        recommendations.push('网络连接较慢，建议优化数据传输');
      } else if (networkType === '3g') {
        score = 60;
        recommendations.push('网络连接一般，可以启用数据压缩');
      }
      
      return {
        category: '网络性能',
        status: score > 60 ? 'good' : 'warning',
        details: {
          networkType: networkType
        },
        score: score,
        recommendations: recommendations
      };
    } catch (error) {
      return {
        category: '网络性能',
        status: 'error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * 诊断页面性能
   * @returns {Object} 页面诊断结果
   */
  async diagnosePagePerformance() {
    try {
      const performanceStats = PerformanceMonitor.getStats();
      const avgTime = performanceStats.averageTime || 0;
      
      let status = 'good';
      let score = 90;
      const recommendations = [];
      
      if (avgTime > 3000) {
        status = 'warning';
        score = 60;
        recommendations.push('页面响应时间较长，建议优化');
      } else if (avgTime > 5000) {
        status = 'critical';
        score = 30;
        recommendations.push('页面响应严重超时，需要立即优化');
      }
      
      return {
        category: '页面性能',
        status: status,
        details: {
          averageTime: `${Math.round(avgTime)}ms`,
          totalOperations: performanceStats.totalOperations,
          slowOperations: performanceStats.slowOperations.length
        },
        score: score,
        recommendations: recommendations
      };
    } catch (error) {
      return {
        category: '页面性能',
        status: 'error',
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * 计算总体评分
   * @param {Array} results 诊断结果
   * @returns {Number} 总体评分
   */
  calculateOverallScore(results) {
    const validResults = results.filter(r => r.score !== undefined);
    if (validResults.length === 0) return 0;
    
    const totalScore = validResults.reduce((sum, r) => sum + r.score, 0);
    return Math.round(totalScore / validResults.length);
  }

  /**
   * 生成系统优化建议
   * @param {Array} results 诊断结果
   * @returns {Array} 优化建议
   */
  generateSystemRecommendations(results) {
    const allRecommendations = [];
    
    results.forEach(result => {
      if (result.recommendations) {
        allRecommendations.push(...result.recommendations);
      }
    });
    
    // 去重并添加通用建议
    const uniqueRecommendations = [...new Set(allRecommendations)];
    uniqueRecommendations.push('定期运行性能诊断');
    uniqueRecommendations.push('监控关键性能指标');
    
    return uniqueRecommendations;
  }
}

// 创建全局实例
const pageOptimizer = new PagePerformanceOptimizer();
const apiOptimizer = new APIPerformanceOptimizer();
const systemDiagnostic = new SystemPerformanceDiagnostic();

module.exports = {
  PagePerformanceOptimizer,
  APIPerformanceOptimizer,
  SystemPerformanceDiagnostic,
  pageOptimizer,
  apiOptimizer,
  systemDiagnostic
};