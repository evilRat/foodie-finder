/**
 * 系统兼容性检查工具
 * 任务6.3: 验证系统在不同设备上的兼容性
 * 
 * 功能包括:
 * - 设备兼容性检测
 * - 微信版本兼容性
 * - API功能支持检测
 * - 性能基准测试
 * - 兼容性问题自动修复
 */

const { debugMonitor } = require('./debug-monitor');
const { PerformanceMonitor } = require('./util');

/**
 * 兼容性检查器
 */
class CompatibilityChecker {
  constructor() {
    this.deviceInfo = null;
    this.compatibilityReport = null;
    this.supportedFeatures = new Map();
    this.performanceBenchmarks = new Map();
    this.compatibilityIssues = [];
  }

  /**
   * 运行完整的兼容性检查
   * @returns {Object} 兼容性报告
   */
  async runFullCompatibilityCheck() {
    console.log('🔍 开始系统兼容性检查...');
    
    try {
      // 获取设备信息
      await this.getDeviceInfo();
      
      // 检查各项兼容性
      const checks = [
        this.checkWeChatVersion(),
        this.checkDeviceCapabilities(),
        this.checkAPISupport(),
        this.checkPerformanceBenchmarks(),
        this.checkStorageCapabilities(),
        this.checkNetworkCapabilities(),
        this.checkImageProcessingCapabilities()
      ];
      
      const results = await Promise.all(checks);
      
      // 生成兼容性报告
      this.compatibilityReport = {
        timestamp: new Date().toISOString(),
        deviceInfo: this.deviceInfo,
        checkResults: results,
        overallCompatibility: this.calculateOverallCompatibility(results),
        issues: this.compatibilityIssues,
        recommendations: this.generateCompatibilityRecommendations(results)
      };
      
      console.log('📊 兼容性检查完成:', this.compatibilityReport);
      return this.compatibilityReport;
      
    } catch (error) {
      console.error('兼容性检查失败:', error);
      debugMonitor.logError('compatibility_check', error);
      throw error;
    }
  }

  /**
   * 获取设备信息
   */
  async getDeviceInfo() {
    return new Promise((resolve, reject) => {
      wx.getSystemInfo({
        success: (res) => {
          this.deviceInfo = {
            // 基本信息
            brand: res.brand,
            model: res.model,
            platform: res.platform,
            system: res.system,
            version: res.version,
            SDKVersion: res.SDKVersion,
            
            // 屏幕信息
            screenWidth: res.screenWidth,
            screenHeight: res.screenHeight,
            windowWidth: res.windowWidth,
            windowHeight: res.windowHeight,
            pixelRatio: res.pixelRatio,
            
            // 性能信息
            benchmarkLevel: res.benchmarkLevel,
            
            // 网络信息
            networkType: res.networkType,
            
            // 其他信息
            language: res.language,
            fontSizeSetting: res.fontSizeSetting,
            theme: res.theme
          };
          
          console.log('📱 设备信息获取成功:', this.deviceInfo);
          resolve(this.deviceInfo);
        },
        fail: (error) => {
          console.error('获取设备信息失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 检查微信版本兼容性
   * @returns {Object} 微信版本检查结果
   */
  async checkWeChatVersion() {
    try {
      const minRequiredVersion = '7.0.0';
      const currentVersion = this.deviceInfo.version;
      
      const isSupported = this.compareVersions(currentVersion, minRequiredVersion) >= 0;
      
      const result = {
        category: '微信版本',
        supported: isSupported,
        currentVersion: currentVersion,
        minRequiredVersion: minRequiredVersion,
        details: {
          SDKVersion: this.deviceInfo.SDKVersion,
          platform: this.deviceInfo.platform
        }
      };
      
      if (!isSupported) {
        this.compatibilityIssues.push({
          type: 'version',
          severity: 'critical',
          message: `微信版本过低，当前版本: ${currentVersion}，最低要求: ${minRequiredVersion}`,
          solution: '请升级微信到最新版本'
        });
      }
      
      return result;
    } catch (error) {
      return {
        category: '微信版本',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 检查设备能力
   * @returns {Object} 设备能力检查结果
   */
  async checkDeviceCapabilities() {
    try {
      const capabilities = {
        // 屏幕分辨率检查
        screenResolution: this.checkScreenResolution(),
        
        // 内存检查
        memoryLevel: this.checkMemoryLevel(),
        
        // 处理器性能检查
        processorLevel: this.checkProcessorLevel(),
        
        // 存储空间检查
        storageSpace: await this.checkStorageSpace()
      };
      
      const allSupported = Object.values(capabilities).every(cap => cap.supported);
      
      return {
        category: '设备能力',
        supported: allSupported,
        capabilities: capabilities,
        details: {
          brand: this.deviceInfo.brand,
          model: this.deviceInfo.model,
          system: this.deviceInfo.system
        }
      };
    } catch (error) {
      return {
        category: '设备能力',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 检查屏幕分辨率
   * @returns {Object} 屏幕分辨率检查结果
   */
  checkScreenResolution() {
    const minWidth = 320;
    const minHeight = 480;
    
    const supported = this.deviceInfo.screenWidth >= minWidth && 
                     this.deviceInfo.screenHeight >= minHeight;
    
    if (!supported) {
      this.compatibilityIssues.push({
        type: 'screen',
        severity: 'medium',
        message: `屏幕分辨率过低: ${this.deviceInfo.screenWidth}x${this.deviceInfo.screenHeight}`,
        solution: '部分界面可能显示不完整'
      });
    }
    
    return {
      supported: supported,
      current: `${this.deviceInfo.screenWidth}x${this.deviceInfo.screenHeight}`,
      minimum: `${minWidth}x${minHeight}`,
      pixelRatio: this.deviceInfo.pixelRatio
    };
  }

  /**
   * 检查内存水平
   * @returns {Object} 内存检查结果
   */
  checkMemoryLevel() {
    // 基于设备型号和系统版本推断内存水平
    const memoryLevel = this.estimateMemoryLevel();
    const supported = memoryLevel >= 2; // 至少2GB内存
    
    if (!supported) {
      this.compatibilityIssues.push({
        type: 'memory',
        severity: 'medium',
        message: '设备内存可能不足，可能影响应用性能',
        solution: '建议关闭其他应用以释放内存'
      });
    }
    
    return {
      supported: supported,
      estimatedLevel: memoryLevel,
      recommendation: memoryLevel < 4 ? '建议关闭后台应用' : '内存充足'
    };
  }

  /**
   * 估算内存水平
   * @returns {Number} 估算的内存大小(GB)
   */
  estimateMemoryLevel() {
    const { brand, model, system } = this.deviceInfo;
    
    // 基于品牌和型号的简单估算
    if (brand === 'iPhone') {
      if (model.includes('iPhone X') || model.includes('iPhone 11') || model.includes('iPhone 12')) {
        return 4;
      } else if (model.includes('iPhone 8') || model.includes('iPhone 7')) {
        return 3;
      } else {
        return 2;
      }
    }
    
    // Android设备基于系统版本估算
    if (system.includes('Android')) {
      const androidVersion = parseFloat(system.match(/Android (\d+\.\d+)/)?.[1] || '0');
      if (androidVersion >= 10) return 4;
      if (androidVersion >= 8) return 3;
      return 2;
    }
    
    return 2; // 默认估算
  }

  /**
   * 检查处理器水平
   * @returns {Object} 处理器检查结果
   */
  checkProcessorLevel() {
    const benchmarkLevel = this.deviceInfo.benchmarkLevel || 0;
    const supported = benchmarkLevel >= 1; // 基本性能要求
    
    if (!supported) {
      this.compatibilityIssues.push({
        type: 'processor',
        severity: 'medium',
        message: '设备处理器性能较低，可能影响图片处理速度',
        solution: '建议使用较小尺寸的图片'
      });
    }
    
    return {
      supported: supported,
      benchmarkLevel: benchmarkLevel,
      performance: benchmarkLevel >= 2 ? 'high' : benchmarkLevel >= 1 ? 'medium' : 'low'
    };
  }

  /**
   * 检查存储空间
   * @returns {Promise<Object>} 存储空间检查结果
   */
  async checkStorageSpace() {
    try {
      const storageInfo = wx.getStorageInfoSync();
      const usagePercentage = (storageInfo.currentSize / storageInfo.limitSize) * 100;
      const availableSpace = storageInfo.limitSize - storageInfo.currentSize;
      
      const supported = availableSpace > 1024; // 至少1MB可用空间
      
      if (!supported) {
        this.compatibilityIssues.push({
          type: 'storage',
          severity: 'high',
          message: '存储空间不足，可能影响应用功能',
          solution: '请清理存储空间或删除不必要的数据'
        });
      }
      
      return {
        supported: supported,
        currentSize: storageInfo.currentSize,
        limitSize: storageInfo.limitSize,
        availableSpace: availableSpace,
        usagePercentage: Math.round(usagePercentage)
      };
    } catch (error) {
      return {
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 检查API支持情况
   * @returns {Object} API支持检查结果
   */
  async checkAPISupport() {
    try {
      const apiTests = [
        { name: 'chooseImage', test: () => typeof wx.chooseImage === 'function' },
        { name: 'compressImage', test: () => typeof wx.compressImage === 'function' },
        { name: 'getImageInfo', test: () => typeof wx.getImageInfo === 'function' },
        { name: 'request', test: () => typeof wx.request === 'function' },
        { name: 'uploadFile', test: () => typeof wx.uploadFile === 'function' },
        { name: 'getStorageSync', test: () => typeof wx.getStorageSync === 'function' },
        { name: 'setStorageSync', test: () => typeof wx.setStorageSync === 'function' },
        { name: 'showToast', test: () => typeof wx.showToast === 'function' },
        { name: 'showModal', test: () => typeof wx.showModal === 'function' },
        { name: 'navigateTo', test: () => typeof wx.navigateTo === 'function' }
      ];
      
      const results = {};
      let supportedCount = 0;
      
      apiTests.forEach(api => {
        try {
          const supported = api.test();
          results[api.name] = supported;
          if (supported) supportedCount++;
          
          this.supportedFeatures.set(api.name, supported);
          
          if (!supported) {
            this.compatibilityIssues.push({
              type: 'api',
              severity: 'high',
              message: `API ${api.name} 不支持`,
              solution: '部分功能可能无法正常使用'
            });
          }
        } catch (error) {
          results[api.name] = false;
          this.supportedFeatures.set(api.name, false);
        }
      });
      
      const supportRate = (supportedCount / apiTests.length) * 100;
      
      return {
        category: 'API支持',
        supported: supportRate >= 90, // 至少90%的API支持
        supportRate: Math.round(supportRate),
        apiResults: results,
        details: {
          totalAPIs: apiTests.length,
          supportedAPIs: supportedCount,
          unsupportedAPIs: apiTests.length - supportedCount
        }
      };
    } catch (error) {
      return {
        category: 'API支持',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 检查性能基准
   * @returns {Object} 性能基准检查结果
   */
  async checkPerformanceBenchmarks() {
    try {
      console.log('🏃 运行性能基准测试...');
      
      const benchmarks = [
        await this.benchmarkJavaScriptPerformance(),
        await this.benchmarkStoragePerformance(),
        await this.benchmarkImageProcessingPerformance()
      ];
      
      const averageScore = benchmarks.reduce((sum, b) => sum + b.score, 0) / benchmarks.length;
      const supported = averageScore >= 60; // 至少60分
      
      if (!supported) {
        this.compatibilityIssues.push({
          type: 'performance',
          severity: 'medium',
          message: `设备性能较低，基准分数: ${Math.round(averageScore)}`,
          solution: '建议降低图片质量或关闭动画效果'
        });
      }
      
      return {
        category: '性能基准',
        supported: supported,
        averageScore: Math.round(averageScore),
        benchmarks: benchmarks,
        grade: this.getPerformanceGrade(averageScore)
      };
    } catch (error) {
      return {
        category: '性能基准',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * JavaScript性能基准测试
   * @returns {Object} JS性能测试结果
   */
  async benchmarkJavaScriptPerformance() {
    const startTime = Date.now();
    
    // 执行计算密集型任务
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    
    const duration = Date.now() - startTime;
    const score = Math.max(0, 100 - (duration / 10)); // 基于执行时间计算分数
    
    this.performanceBenchmarks.set('javascript', { duration, score });
    
    return {
      name: 'JavaScript性能',
      duration: duration,
      score: Math.round(score),
      result: result
    };
  }

  /**
   * 存储性能基准测试
   * @returns {Object} 存储性能测试结果
   */
  async benchmarkStoragePerformance() {
    const startTime = Date.now();
    
    try {
      // 测试存储读写性能
      const testData = { test: 'performance_benchmark', timestamp: Date.now() };
      
      // 写入测试
      for (let i = 0; i < 10; i++) {
        wx.setStorageSync(`benchmark_test_${i}`, testData);
      }
      
      // 读取测试
      for (let i = 0; i < 10; i++) {
        wx.getStorageSync(`benchmark_test_${i}`);
      }
      
      // 清理测试数据
      for (let i = 0; i < 10; i++) {
        wx.removeStorageSync(`benchmark_test_${i}`);
      }
      
      const duration = Date.now() - startTime;
      const score = Math.max(0, 100 - (duration / 5));
      
      this.performanceBenchmarks.set('storage', { duration, score });
      
      return {
        name: '存储性能',
        duration: duration,
        score: Math.round(score)
      };
    } catch (error) {
      return {
        name: '存储性能',
        duration: Date.now() - startTime,
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * 图片处理性能基准测试
   * @returns {Object} 图片处理性能测试结果
   */
  async benchmarkImageProcessingPerformance() {
    const startTime = Date.now();
    
    try {
      // 模拟图片处理任务
      const imageData = new Array(1000).fill(0).map(() => Math.random() * 255);
      
      // 模拟图片压缩算法
      const processedData = imageData.map(pixel => {
        return Math.floor(pixel * 0.8); // 简单的压缩模拟
      });
      
      const duration = Date.now() - startTime;
      const score = Math.max(0, 100 - (duration / 2));
      
      this.performanceBenchmarks.set('imageProcessing', { duration, score });
      
      return {
        name: '图片处理性能',
        duration: duration,
        score: Math.round(score),
        processedPixels: processedData.length
      };
    } catch (error) {
      return {
        name: '图片处理性能',
        duration: Date.now() - startTime,
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * 检查存储能力
   * @returns {Object} 存储能力检查结果
   */
  async checkStorageCapabilities() {
    try {
      const capabilities = {
        localStorage: this.testLocalStorage(),
        sessionStorage: this.testSessionStorage(),
        indexedDB: this.testIndexedDB()
      };
      
      const supportedCount = Object.values(capabilities).filter(c => c.supported).length;
      const supported = supportedCount >= 1; // 至少支持一种存储方式
      
      return {
        category: '存储能力',
        supported: supported,
        capabilities: capabilities,
        supportedCount: supportedCount
      };
    } catch (error) {
      return {
        category: '存储能力',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 测试本地存储
   * @returns {Object} 本地存储测试结果
   */
  testLocalStorage() {
    try {
      const testKey = 'compatibility_test';
      const testValue = 'test_value';
      
      wx.setStorageSync(testKey, testValue);
      const retrieved = wx.getStorageSync(testKey);
      wx.removeStorageSync(testKey);
      
      return {
        supported: retrieved === testValue,
        type: 'localStorage'
      };
    } catch (error) {
      return {
        supported: false,
        type: 'localStorage',
        error: error.message
      };
    }
  }

  /**
   * 测试会话存储
   * @returns {Object} 会话存储测试结果
   */
  testSessionStorage() {
    // 微信小程序没有sessionStorage，返回不支持
    return {
      supported: false,
      type: 'sessionStorage',
      reason: '微信小程序不支持sessionStorage'
    };
  }

  /**
   * 测试IndexedDB
   * @returns {Object} IndexedDB测试结果
   */
  testIndexedDB() {
    // 微信小程序没有IndexedDB，返回不支持
    return {
      supported: false,
      type: 'indexedDB',
      reason: '微信小程序不支持IndexedDB'
    };
  }

  /**
   * 检查网络能力
   * @returns {Object} 网络能力检查结果
   */
  async checkNetworkCapabilities() {
    try {
      const networkInfo = await this.getNetworkInfo();
      const capabilities = {
        networkType: networkInfo.networkType,
        isConnected: networkInfo.isConnected,
        signalStrength: this.estimateSignalStrength(networkInfo.networkType)
      };
      
      const supported = networkInfo.isConnected && networkInfo.networkType !== 'none';
      
      if (!supported) {
        this.compatibilityIssues.push({
          type: 'network',
          severity: 'critical',
          message: '网络连接不可用',
          solution: '请检查网络连接'
        });
      }
      
      return {
        category: '网络能力',
        supported: supported,
        capabilities: capabilities
      };
    } catch (error) {
      return {
        category: '网络能力',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 获取网络信息
   * @returns {Promise<Object>} 网络信息
   */
  async getNetworkInfo() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve({
            networkType: res.networkType,
            isConnected: res.networkType !== 'none'
          });
        },
        fail: () => {
          resolve({
            networkType: 'unknown',
            isConnected: false
          });
        }
      });
    });
  }

  /**
   * 估算信号强度
   * @param {String} networkType 网络类型
   * @returns {String} 信号强度
   */
  estimateSignalStrength(networkType) {
    const strengthMap = {
      'wifi': 'excellent',
      '4g': 'good',
      '3g': 'fair',
      '2g': 'poor',
      'none': 'none',
      'unknown': 'unknown'
    };
    
    return strengthMap[networkType] || 'unknown';
  }

  /**
   * 检查图片处理能力
   * @returns {Object} 图片处理能力检查结果
   */
  async checkImageProcessingCapabilities() {
    try {
      const capabilities = {
        chooseImage: this.supportedFeatures.get('chooseImage') || false,
        compressImage: this.supportedFeatures.get('compressImage') || false,
        getImageInfo: this.supportedFeatures.get('getImageInfo') || false,
        canvasSupport: this.testCanvasSupport()
      };
      
      const supportedCount = Object.values(capabilities).filter(c => c).length;
      const supported = supportedCount >= 3; // 至少支持3个功能
      
      if (!supported) {
        this.compatibilityIssues.push({
          type: 'image',
          severity: 'high',
          message: '图片处理功能支持不完整',
          solution: '部分图片功能可能无法使用'
        });
      }
      
      return {
        category: '图片处理能力',
        supported: supported,
        capabilities: capabilities,
        supportedCount: supportedCount
      };
    } catch (error) {
      return {
        category: '图片处理能力',
        supported: false,
        error: error.message
      };
    }
  }

  /**
   * 测试Canvas支持
   * @returns {Boolean} 是否支持Canvas
   */
  testCanvasSupport() {
    try {
      // 微信小程序中Canvas的测试
      return typeof wx.createCanvasContext === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * 比较版本号
   * @param {String} version1 版本1
   * @param {String} version2 版本2
   * @returns {Number} 比较结果 (-1, 0, 1)
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * 计算总体兼容性
   * @param {Array} results 检查结果
   * @returns {String} 兼容性等级
   */
  calculateOverallCompatibility(results) {
    const supportedCount = results.filter(r => r.supported).length;
    const totalCount = results.length;
    const supportRate = (supportedCount / totalCount) * 100;
    
    if (supportRate >= 90) return 'excellent';
    if (supportRate >= 75) return 'good';
    if (supportRate >= 60) return 'fair';
    return 'poor';
  }

  /**
   * 获取性能等级
   * @param {Number} score 性能分数
   * @returns {String} 性能等级
   */
  getPerformanceGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  /**
   * 生成兼容性建议
   * @param {Array} results 检查结果
   * @returns {Array} 建议列表
   */
  generateCompatibilityRecommendations(results) {
    const recommendations = [];
    
    // 基于检查结果生成建议
    results.forEach(result => {
      if (!result.supported) {
        switch (result.category) {
          case '微信版本':
            recommendations.push('升级微信到最新版本以获得最佳体验');
            break;
          case '设备能力':
            recommendations.push('设备性能较低，建议关闭后台应用');
            break;
          case 'API支持':
            recommendations.push('部分功能可能不可用，建议使用备用方案');
            break;
          case '性能基准':
            recommendations.push('设备性能不足，建议降低图片质量');
            break;
          case '网络能力':
            recommendations.push('检查网络连接，确保网络稳定');
            break;
        }
      }
    });
    
    // 基于兼容性问题生成建议
    const criticalIssues = this.compatibilityIssues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('存在严重兼容性问题，建议更新设备或微信版本');
    }
    
    // 通用建议
    recommendations.push('定期检查应用更新');
    recommendations.push('保持微信版本为最新');
    
    return [...new Set(recommendations)]; // 去重
  }

  /**
   * 获取兼容性报告
   * @returns {Object} 兼容性报告
   */
  getCompatibilityReport() {
    return this.compatibilityReport;
  }

  /**
   * 获取设备信息
   * @returns {Object} 设备信息
   */
  getDeviceInformation() {
    return this.deviceInfo;
  }

  /**
   * 获取支持的功能列表
   * @returns {Map} 支持的功能
   */
  getSupportedFeatures() {
    return this.supportedFeatures;
  }

  /**
   * 获取性能基准结果
   * @returns {Map} 性能基准
   */
  getPerformanceBenchmarks() {
    return this.performanceBenchmarks;
  }

  /**
   * 获取兼容性问题列表
   * @returns {Array} 兼容性问题
   */
  getCompatibilityIssues() {
    return this.compatibilityIssues;
  }
}

// 创建全局兼容性检查器实例
const compatibilityChecker = new CompatibilityChecker();

module.exports = {
  CompatibilityChecker,
  compatibilityChecker
};