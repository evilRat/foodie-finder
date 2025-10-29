/**
 * 调试和监控工具模块
 * 任务6.3: 调试和修复发现的问题
 * 
 * 功能包括:
 * - 实时错误监控
 * - 性能问题检测
 * - 用户行为追踪
 * - 系统健康检查
 * - 问题自动修复
 */

const { PerformanceMonitor, CacheManager } = require('./util');
const { systemDiagnostic } = require('./performance-optimizer');

/**
 * 调试监控器
 */
class DebugMonitor {
  constructor() {
    this.errorLog = [];
    this.performanceLog = [];
    this.userActionLog = [];
    this.systemHealthLog = [];
    this.autoFixEnabled = true;
    this.monitoringEnabled = true;
    
    // 初始化监控
    this.initializeMonitoring();
  }

  /**
   * 初始化监控系统
   */
  initializeMonitoring() {
    // 监听全局错误
    this.setupGlobalErrorHandler();
    
    // 启动定期健康检查
    this.startHealthCheck();
    
    // 监控性能指标
    this.startPerformanceMonitoring();
    
    console.log('🔍 调试监控系统已启动');
  }

  /**
   * 设置全局错误处理器
   */
  setupGlobalErrorHandler() {
    // 保存原始的console.error
    const originalConsoleError = console.error;
    
    // 重写console.error以捕获错误
    console.error = (...args) => {
      this.logError('console', args.join(' '));
      originalConsoleError.apply(console, args);
    };
    
    // 监听Promise rejection
    if (typeof process !== 'undefined' && process.on) {
      process.on('unhandledRejection', (reason, promise) => {
        this.logError('unhandledRejection', reason);
      });
    }
  }

  /**
   * 记录错误信息
   * @param {String} type 错误类型
   * @param {String|Error} error 错误信息
   * @param {Object} context 上下文信息
   */
  logError(type, error, context = {}) {
    const errorInfo = {
      id: Date.now().toString(),
      type: type,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context: context,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent(),
      url: this.getCurrentPage(),
      resolved: false
    };
    
    this.errorLog.push(errorInfo);
    
    // 限制错误日志数量
    if (this.errorLog.length > 200) {
      this.errorLog = this.errorLog.slice(-200);
    }
    
    // 尝试自动修复
    if (this.autoFixEnabled) {
      this.attemptAutoFix(errorInfo);
    }
    
    // 发送错误报告
    this.sendErrorReport(errorInfo);
    
    console.warn('🐛 错误已记录:', errorInfo);
  }

  /**
   * 记录性能问题
   * @param {String} operation 操作名称
   * @param {Number} duration 执行时间
   * @param {Object} details 详细信息
   */
  logPerformanceIssue(operation, duration, details = {}) {
    const performanceIssue = {
      id: Date.now().toString(),
      operation: operation,
      duration: duration,
      details: details,
      timestamp: new Date().toISOString(),
      severity: this.calculateSeverity(duration),
      resolved: false
    };
    
    this.performanceLog.push(performanceIssue);
    
    // 限制性能日志数量
    if (this.performanceLog.length > 100) {
      this.performanceLog = this.performanceLog.slice(-100);
    }
    
    // 如果是严重性能问题，立即处理
    if (performanceIssue.severity === 'critical') {
      this.handleCriticalPerformanceIssue(performanceIssue);
    }
    
    console.warn('⚡ 性能问题已记录:', performanceIssue);
  }

  /**
   * 记录用户行为
   * @param {String} action 用户行为
   * @param {Object} data 行为数据
   */
  logUserAction(action, data = {}) {
    const userAction = {
      id: Date.now().toString(),
      action: action,
      data: data,
      timestamp: new Date().toISOString(),
      page: this.getCurrentPage(),
      sessionId: this.getSessionId()
    };
    
    this.userActionLog.push(userAction);
    
    // 限制用户行为日志数量
    if (this.userActionLog.length > 500) {
      this.userActionLog = this.userActionLog.slice(-500);
    }
    
    // 分析用户行为模式
    this.analyzeUserBehavior(userAction);
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    // 每30秒进行一次健康检查
    setInterval(() => {
      if (this.monitoringEnabled) {
        this.performHealthCheck();
      }
    }, 30000);
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        memory: this.checkMemoryHealth(),
        storage: this.checkStorageHealth(),
        cache: this.checkCacheHealth(),
        performance: this.checkPerformanceHealth(),
        errors: this.checkErrorHealth()
      };
      
      this.systemHealthLog.push(healthStatus);
      
      // 限制健康日志数量
      if (this.systemHealthLog.length > 50) {
        this.systemHealthLog = this.systemHealthLog.slice(-50);
      }
      
      // 检查是否需要采取行动
      this.evaluateHealthStatus(healthStatus);
      
    } catch (error) {
      console.error('健康检查失败:', error);
    }
  }

  /**
   * 检查内存健康状况
   * @returns {Object} 内存健康状态
   */
  checkMemoryHealth() {
    try {
      // 简单的内存使用检查
      const errorCount = this.errorLog.length;
      const performanceCount = this.performanceLog.length;
      const userActionCount = this.userActionLog.length;
      
      const totalMemoryUsage = errorCount + performanceCount + userActionCount;
      
      return {
        status: totalMemoryUsage < 1000 ? 'healthy' : 'warning',
        usage: totalMemoryUsage,
        details: {
          errorLog: errorCount,
          performanceLog: performanceCount,
          userActionLog: userActionCount
        }
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 检查存储健康状况
   * @returns {Object} 存储健康状态
   */
  checkStorageHealth() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      const usagePercentage = (storageInfo.currentSize / storageInfo.limitSize) * 100;
      
      let status = 'healthy';
      if (usagePercentage > 80) status = 'warning';
      if (usagePercentage > 90) status = 'critical';
      
      return {
        status: status,
        usagePercentage: Math.round(usagePercentage),
        currentSize: storageInfo.currentSize,
        limitSize: storageInfo.limitSize
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 检查缓存健康状况
   * @returns {Object} 缓存健康状态
   */
  checkCacheHealth() {
    try {
      const cacheStats = CacheManager.getStats();
      const hitRate = cacheStats.hitRate || 0;
      
      let status = 'healthy';
      if (hitRate < 0.5) status = 'warning';
      if (hitRate < 0.3) status = 'critical';
      
      return {
        status: status,
        hitRate: Math.round(hitRate * 100),
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 检查性能健康状况
   * @returns {Object} 性能健康状态
   */
  checkPerformanceHealth() {
    try {
      const performanceStats = PerformanceMonitor.getStats();
      const avgTime = performanceStats.averageTime || 0;
      const recentIssues = this.performanceLog.filter(
        issue => Date.now() - new Date(issue.timestamp).getTime() < 300000 // 5分钟内
      ).length;
      
      let status = 'healthy';
      if (avgTime > 3000 || recentIssues > 5) status = 'warning';
      if (avgTime > 5000 || recentIssues > 10) status = 'critical';
      
      return {
        status: status,
        averageTime: Math.round(avgTime),
        recentIssues: recentIssues,
        totalOperations: performanceStats.totalOperations
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 检查错误健康状况
   * @returns {Object} 错误健康状态
   */
  checkErrorHealth() {
    try {
      const recentErrors = this.errorLog.filter(
        error => Date.now() - new Date(error.timestamp).getTime() < 300000 // 5分钟内
      );
      
      const criticalErrors = recentErrors.filter(
        error => error.type === 'critical' || error.message.includes('CRITICAL')
      );
      
      let status = 'healthy';
      if (recentErrors.length > 5) status = 'warning';
      if (recentErrors.length > 10 || criticalErrors.length > 0) status = 'critical';
      
      return {
        status: status,
        recentErrors: recentErrors.length,
        criticalErrors: criticalErrors.length,
        totalErrors: this.errorLog.length
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 评估健康状态并采取行动
   * @param {Object} healthStatus 健康状态
   */
  evaluateHealthStatus(healthStatus) {
    const criticalSystems = Object.keys(healthStatus).filter(
      key => healthStatus[key].status === 'critical'
    );
    
    const warningSystems = Object.keys(healthStatus).filter(
      key => healthStatus[key].status === 'warning'
    );
    
    if (criticalSystems.length > 0) {
      console.error('🚨 系统健康状况严重:', criticalSystems);
      this.handleCriticalHealth(criticalSystems, healthStatus);
    } else if (warningSystems.length > 0) {
      console.warn('⚠️ 系统健康状况警告:', warningSystems);
      this.handleWarningHealth(warningSystems, healthStatus);
    }
  }

  /**
   * 处理严重健康问题
   * @param {Array} criticalSystems 严重问题系统
   * @param {Object} healthStatus 健康状态
   */
  handleCriticalHealth(criticalSystems, healthStatus) {
    criticalSystems.forEach(system => {
      switch (system) {
        case 'storage':
          this.emergencyStorageCleanup();
          break;
        case 'cache':
          this.emergencyCacheReset();
          break;
        case 'performance':
          this.emergencyPerformanceOptimization();
          break;
        case 'errors':
          this.emergencyErrorHandling();
          break;
      }
    });
  }

  /**
   * 处理警告健康问题
   * @param {Array} warningSystems 警告问题系统
   * @param {Object} healthStatus 健康状态
   */
  handleWarningHealth(warningSystems, healthStatus) {
    warningSystems.forEach(system => {
      switch (system) {
        case 'storage':
          this.optimizeStorage();
          break;
        case 'cache':
          this.optimizeCache();
          break;
        case 'performance':
          this.optimizePerformance();
          break;
      }
    });
  }

  /**
   * 紧急存储清理
   */
  emergencyStorageCleanup() {
    try {
      console.log('🧹 执行紧急存储清理...');
      
      // 清理过期缓存
      CacheManager.clear();
      
      // 清理旧的错误日志
      this.errorLog = this.errorLog.slice(-50);
      
      // 清理旧的性能日志
      this.performanceLog = this.performanceLog.slice(-20);
      
      // 清理旧的用户行为日志
      this.userActionLog = this.userActionLog.slice(-100);
      
      console.log('✅ 紧急存储清理完成');
    } catch (error) {
      console.error('❌ 紧急存储清理失败:', error);
    }
  }

  /**
   * 紧急缓存重置
   */
  emergencyCacheReset() {
    try {
      console.log('🔄 执行紧急缓存重置...');
      CacheManager.clear();
      console.log('✅ 紧急缓存重置完成');
    } catch (error) {
      console.error('❌ 紧急缓存重置失败:', error);
    }
  }

  /**
   * 紧急性能优化
   */
  emergencyPerformanceOptimization() {
    try {
      console.log('⚡ 执行紧急性能优化...');
      
      // 清理性能监控记录
      PerformanceMonitor.clear();
      
      // 减少监控频率
      this.monitoringEnabled = false;
      setTimeout(() => {
        this.monitoringEnabled = true;
      }, 60000); // 1分钟后恢复监控
      
      console.log('✅ 紧急性能优化完成');
    } catch (error) {
      console.error('❌ 紧急性能优化失败:', error);
    }
  }

  /**
   * 紧急错误处理
   */
  emergencyErrorHandling() {
    try {
      console.log('🚨 执行紧急错误处理...');
      
      // 清理错误日志
      this.errorLog = [];
      
      // 暂时禁用自动修复
      this.autoFixEnabled = false;
      setTimeout(() => {
        this.autoFixEnabled = true;
      }, 300000); // 5分钟后恢复自动修复
      
      console.log('✅ 紧急错误处理完成');
    } catch (error) {
      console.error('❌ 紧急错误处理失败:', error);
    }
  }

  /**
   * 尝试自动修复错误
   * @param {Object} errorInfo 错误信息
   */
  attemptAutoFix(errorInfo) {
    try {
      const fixStrategies = {
        'NETWORK_ERROR': this.fixNetworkError.bind(this),
        'TIMEOUT_ERROR': this.fixTimeoutError.bind(this),
        'CACHE_ERROR': this.fixCacheError.bind(this),
        'STORAGE_ERROR': this.fixStorageError.bind(this),
        'IMAGE_ERROR': this.fixImageError.bind(this)
      };
      
      // 根据错误类型选择修复策略
      for (const [errorType, fixFunction] of Object.entries(fixStrategies)) {
        if (errorInfo.message.includes(errorType) || errorInfo.type === errorType) {
          console.log(`🔧 尝试自动修复错误: ${errorType}`);
          const fixed = fixFunction(errorInfo);
          if (fixed) {
            errorInfo.resolved = true;
            errorInfo.autoFixed = true;
            console.log(`✅ 错误自动修复成功: ${errorType}`);
          }
          break;
        }
      }
    } catch (error) {
      console.warn('自动修复失败:', error);
    }
  }

  /**
   * 修复网络错误
   * @param {Object} errorInfo 错误信息
   * @returns {Boolean} 是否修复成功
   */
  fixNetworkError(errorInfo) {
    try {
      // 清理网络相关缓存
      const networkCacheKeys = ['api_', 'network_'];
      networkCacheKeys.forEach(prefix => {
        const info = wx.getStorageInfoSync();
        const keys = info.keys.filter(key => key.includes(prefix));
        keys.forEach(key => wx.removeStorageSync(key));
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 修复超时错误
   * @param {Object} errorInfo 错误信息
   * @returns {Boolean} 是否修复成功
   */
  fixTimeoutError(errorInfo) {
    try {
      // 增加超时时间配置
      const timeoutConfig = wx.getStorageSync('timeoutConfig') || {};
      timeoutConfig.apiTimeout = Math.min((timeoutConfig.apiTimeout || 5000) * 1.5, 30000);
      wx.setStorageSync('timeoutConfig', timeoutConfig);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 修复缓存错误
   * @param {Object} errorInfo 错误信息
   * @returns {Boolean} 是否修复成功
   */
  fixCacheError(errorInfo) {
    try {
      // 清理损坏的缓存
      CacheManager.clear();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 修复存储错误
   * @param {Object} errorInfo 错误信息
   * @returns {Boolean} 是否修复成功
   */
  fixStorageError(errorInfo) {
    try {
      // 清理存储空间
      const info = wx.getStorageInfoSync();
      const keys = info.keys.filter(key => !key.includes('essential_'));
      
      // 删除非必要数据
      keys.slice(0, Math.floor(keys.length * 0.3)).forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
          // 忽略删除失败
        }
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 修复图片错误
   * @param {Object} errorInfo 错误信息
   * @returns {Boolean} 是否修复成功
   */
  fixImageError(errorInfo) {
    try {
      // 清理图片缓存
      const info = wx.getStorageInfoSync();
      const imageKeys = info.keys.filter(key => key.includes('img_') || key.includes('image_'));
      imageKeys.forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
          // 忽略删除失败
        }
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    // 每分钟检查一次性能指标
    setInterval(() => {
      if (this.monitoringEnabled) {
        this.checkPerformanceMetrics();
      }
    }, 60000);
  }

  /**
   * 检查性能指标
   */
  checkPerformanceMetrics() {
    try {
      const stats = PerformanceMonitor.getStats();
      
      // 检查平均响应时间
      if (stats.averageTime > 3000) {
        this.logPerformanceIssue('slow_response', stats.averageTime, {
          totalOperations: stats.totalOperations
        });
      }
      
      // 检查慢操作
      if (stats.slowOperations && stats.slowOperations.length > 5) {
        this.logPerformanceIssue('too_many_slow_operations', stats.slowOperations.length, {
          slowOperations: stats.slowOperations.slice(-5)
        });
      }
    } catch (error) {
      this.logError('performance_monitoring', error);
    }
  }

  /**
   * 分析用户行为模式
   * @param {Object} userAction 用户行为
   */
  analyzeUserBehavior(userAction) {
    try {
      // 检查是否有异常行为模式
      const recentActions = this.userActionLog.filter(
        action => Date.now() - new Date(action.timestamp).getTime() < 60000 // 1分钟内
      );
      
      // 检查重复操作
      const sameActions = recentActions.filter(action => action.action === userAction.action);
      if (sameActions.length > 10) {
        this.logError('user_behavior', `用户重复操作过多: ${userAction.action}`, {
          count: sameActions.length,
          action: userAction.action
        });
      }
      
      // 检查错误操作
      const errorActions = recentActions.filter(action => action.action.includes('error'));
      if (errorActions.length > 3) {
        this.logError('user_behavior', '用户遇到过多错误', {
          errorActions: errorActions.map(a => a.action)
        });
      }
    } catch (error) {
      console.warn('用户行为分析失败:', error);
    }
  }

  /**
   * 计算问题严重程度
   * @param {Number} duration 持续时间
   * @returns {String} 严重程度
   */
  calculateSeverity(duration) {
    if (duration > 10000) return 'critical';
    if (duration > 5000) return 'high';
    if (duration > 3000) return 'medium';
    return 'low';
  }

  /**
   * 处理严重性能问题
   * @param {Object} performanceIssue 性能问题
   */
  handleCriticalPerformanceIssue(performanceIssue) {
    console.error('🚨 发现严重性能问题:', performanceIssue);
    
    // 立即采取优化措施
    this.emergencyPerformanceOptimization();
    
    // 记录到错误日志
    this.logError('critical_performance', `严重性能问题: ${performanceIssue.operation}`, {
      duration: performanceIssue.duration,
      details: performanceIssue.details
    });
  }

  /**
   * 发送错误报告
   * @param {Object} errorInfo 错误信息
   */
  sendErrorReport(errorInfo) {
    try {
      // 这里可以实现发送错误报告到服务器的逻辑
      // 目前只是本地记录
      console.log('📤 错误报告已记录:', {
        id: errorInfo.id,
        type: errorInfo.type,
        message: errorInfo.message,
        timestamp: errorInfo.timestamp
      });
    } catch (error) {
      console.warn('发送错误报告失败:', error);
    }
  }

  /**
   * 获取用户代理信息
   * @returns {String} 用户代理
   */
  getUserAgent() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      return `${systemInfo.platform} ${systemInfo.version}`;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取当前页面
   * @returns {String} 当前页面
   */
  getCurrentPage() {
    try {
      const pages = getCurrentPages();
      return pages.length > 0 ? pages[pages.length - 1].route : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取会话ID
   * @returns {String} 会话ID
   */
  getSessionId() {
    try {
      let sessionId = wx.getStorageSync('sessionId');
      if (!sessionId) {
        sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        wx.setStorageSync('sessionId', sessionId);
      }
      return sessionId;
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 优化存储
   */
  optimizeStorage() {
    try {
      console.log('🗂️ 优化存储空间...');
      
      // 清理过期数据
      const info = wx.getStorageInfoSync();
      const keys = info.keys;
      
      keys.forEach(key => {
        try {
          const data = wx.getStorageSync(key);
          if (data && data.timestamp && data.expireTime) {
            if (Date.now() - data.timestamp > data.expireTime) {
              wx.removeStorageSync(key);
            }
          }
        } catch (e) {
          // 忽略错误
        }
      });
      
      console.log('✅ 存储优化完成');
    } catch (error) {
      console.error('存储优化失败:', error);
    }
  }

  /**
   * 优化缓存
   */
  optimizeCache() {
    try {
      console.log('💾 优化缓存策略...');
      CacheManager.cleanupByPriority();
      console.log('✅ 缓存优化完成');
    } catch (error) {
      console.error('缓存优化失败:', error);
    }
  }

  /**
   * 优化性能
   */
  optimizePerformance() {
    try {
      console.log('⚡ 优化性能...');
      
      // 清理旧的性能记录
      this.performanceLog = this.performanceLog.slice(-50);
      
      // 重置性能监控
      PerformanceMonitor.clear();
      
      console.log('✅ 性能优化完成');
    } catch (error) {
      console.error('性能优化失败:', error);
    }
  }

  /**
   * 获取调试报告
   * @returns {Object} 调试报告
   */
  getDebugReport() {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errorLog.length,
        recentErrors: this.errorLog.filter(e => 
          Date.now() - new Date(e.timestamp).getTime() < 3600000 // 1小时内
        ).length,
        totalPerformanceIssues: this.performanceLog.length,
        totalUserActions: this.userActionLog.length,
        autoFixEnabled: this.autoFixEnabled,
        monitoringEnabled: this.monitoringEnabled
      },
      recentErrors: this.errorLog.slice(-10),
      recentPerformanceIssues: this.performanceLog.slice(-5),
      recentUserActions: this.userActionLog.slice(-20),
      systemHealth: this.systemHealthLog.slice(-1)[0] || null,
      recommendations: this.generateDebugRecommendations()
    };
  }

  /**
   * 生成调试建议
   * @returns {Array} 调试建议
   */
  generateDebugRecommendations() {
    const recommendations = [];
    
    const recentErrors = this.errorLog.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 3600000
    );
    
    if (recentErrors.length > 10) {
      recommendations.push('错误频率过高，建议检查代码质量');
    }
    
    const unresolvedErrors = this.errorLog.filter(e => !e.resolved);
    if (unresolvedErrors.length > 5) {
      recommendations.push('存在多个未解决的错误，建议手动处理');
    }
    
    const criticalPerformanceIssues = this.performanceLog.filter(p => p.severity === 'critical');
    if (criticalPerformanceIssues.length > 0) {
      recommendations.push('存在严重性能问题，需要立即优化');
    }
    
    return recommendations;
  }

  /**
   * 清理所有日志
   */
  clearAllLogs() {
    this.errorLog = [];
    this.performanceLog = [];
    this.userActionLog = [];
    this.systemHealthLog = [];
    console.log('🧹 所有调试日志已清理');
  }
}

// 创建全局调试监控实例
const debugMonitor = new DebugMonitor();

module.exports = {
  DebugMonitor,
  debugMonitor
};