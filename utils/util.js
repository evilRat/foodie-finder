/**
 * 通用工具函数模块
 * 包含图片处理、错误处理、加载状态管理等功能
 */

/**
 * 智能图片压缩功能 - 增强版 (需求2.3, 3.5, 5.5)
 * @param {String} imagePath 原始图片路径
 * @param {Object} options 压缩选项
 * @returns {Promise} 压缩后的图片路径
 */
function compressImage(imagePath, options = {}) {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      // 获取图片信息
      const imageInfo = await getImageInfo(imagePath);
      
      // 检查缓存 - 添加本地缓存机制 (需求5.5)
      const cacheKey = generateImageCacheKey(imagePath, imageInfo, options);
      const cachedPath = CacheManager.get(cacheKey);
      
      if (cachedPath && await isFileExists(cachedPath)) {
        console.log('使用缓存的压缩图片:', cacheKey);
        resolve(cachedPath);
        return;
      }
      
      // 计算最佳压缩参数 - 优化API调用的响应时间 (需求5.5)
      const compressOptions = calculateOptimalCompression(imageInfo, options);
      
      // 如果图片已经足够小，直接返回
      if (!compressOptions.needsCompression) {
        console.log('图片无需压缩，直接使用原图');
        resolve(imagePath);
        return;
      }
      
      // 执行压缩 - 实现图片压缩功能减少上传时间 (需求2.3)
      wx.compressImage({
        src: imagePath,
        quality: compressOptions.quality,
        compressedWidth: compressOptions.width,
        compressedHeight: compressOptions.height,
        success: (res) => {
          const processingTime = Date.now() - startTime;
          console.log('图片压缩成功:', {
            original: imageInfo,
            compressed: compressOptions,
            processingTime: `${processingTime}ms`
          });
          
          // 缓存压缩结果 - 添加本地缓存机制 (需求5.5)
          CacheManager.set(cacheKey, res.tempFilePath, 24 * 60 * 60 * 1000); // 缓存24小时
          
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          console.warn('图片压缩失败，使用原图:', error);
          // 压缩失败时返回原图
          resolve(imagePath);
        }
      });
    } catch (error) {
      console.warn('图片压缩过程出错，使用原图:', error);
      resolve(imagePath);
    }
  });
}

/**
 * 计算最佳压缩参数 - 增强版 (需求2.3, 5.5)
 * @param {Object} imageInfo 图片信息
 * @param {Object} options 用户选项
 * @returns {Object} 压缩参数
 */
function calculateOptimalCompression(imageInfo, options = {}) {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    maxFileSize = 500 * 1024, // 500KB
    quality = 80,
    preserveAspectRatio = true,
    smartQuality = true
  } = options;
  
  const { width, height, type } = imageInfo;
  
  // 根据图片类型调整压缩策略
  const typeMultipliers = {
    'jpeg': 1.0,
    'jpg': 1.0,
    'png': 1.2, // PNG通常需要更高质量
    'webp': 0.8  // WebP压缩效率更高
  };
  
  const typeMultiplier = typeMultipliers[type?.toLowerCase()] || 1.0;
  const adjustedMaxFileSize = maxFileSize * typeMultiplier;
  
  // 检查是否需要压缩
  const needsResize = width > maxWidth || height > maxHeight;
  const estimatedSize = calculateEstimatedFileSize(width, height, type);
  const needsSizeReduction = estimatedSize > adjustedMaxFileSize;
  
  if (!needsResize && !needsSizeReduction) {
    return { needsCompression: false };
  }
  
  // 智能计算缩放比例
  let scale = 1;
  if (needsResize) {
    if (preserveAspectRatio) {
      scale = Math.min(maxWidth / width, maxHeight / height);
    } else {
      scale = Math.sqrt((maxWidth * maxHeight) / (width * height));
    }
  }
  
  // 如果文件太大，进一步缩小
  if (needsSizeReduction && scale === 1) {
    scale = Math.sqrt(adjustedMaxFileSize / estimatedSize);
  }
  
  // 确保缩放比例合理
  scale = Math.max(0.1, Math.min(1, scale));
  
  // 计算最终尺寸
  const finalWidth = Math.floor(width * scale);
  const finalHeight = Math.floor(height * scale);
  
  // 智能质量调整 - 优化API调用的响应时间 (需求5.5)
  let finalQuality = quality;
  if (smartQuality) {
    if (scale < 0.3) {
      finalQuality = Math.max(50, quality - 20);
    } else if (scale < 0.5) {
      finalQuality = Math.max(60, quality - 15);
    } else if (scale < 0.7) {
      finalQuality = Math.max(70, quality - 10);
    } else if (scale < 0.9) {
      finalQuality = Math.max(75, quality - 5);
    }
    
    // 根据图片类型微调质量
    if (type?.toLowerCase() === 'png') {
      finalQuality = Math.min(90, finalQuality + 5);
    }
  }
  
  return {
    needsCompression: true,
    width: finalWidth,
    height: finalHeight,
    quality: finalQuality,
    scale: scale,
    originalSize: estimatedSize,
    estimatedCompressedSize: estimatedSize * scale * scale * (finalQuality / 100)
  };
}

/**
 * 计算估算文件大小
 * @param {Number} width 宽度
 * @param {Number} height 高度
 * @param {String} type 图片类型
 * @returns {Number} 估算文件大小（字节）
 */
function calculateEstimatedFileSize(width, height, type) {
  const pixels = width * height;
  
  // 根据图片类型估算压缩比
  const compressionRatios = {
    'jpeg': 12, // JPEG通常压缩比较高
    'jpg': 12,
    'png': 4,   // PNG压缩比较低
    'webp': 15  // WebP压缩比很高
  };
  
  const ratio = compressionRatios[type?.toLowerCase()] || 8;
  return Math.floor(pixels * 3 / ratio); // 3字节每像素除以压缩比
}

/**
 * 生成图片缓存键
 * @param {String} imagePath 图片路径
 * @param {Object} imageInfo 图片信息
 * @param {Object} options 压缩选项
 * @returns {String} 缓存键
 */
function generateImageCacheKey(imagePath, imageInfo, options) {
  const pathHash = imagePath.split('/').pop() || 'unknown';
  const sizeInfo = `${imageInfo.width}x${imageInfo.height}`;
  const optionsHash = JSON.stringify(options);
  return `img_${pathHash}_${sizeInfo}_${btoa(optionsHash).slice(0, 8)}`;
}

/**
 * 检查文件是否存在
 * @param {String} filePath 文件路径
 * @returns {Promise<Boolean>} 文件是否存在
 */
function isFileExists(filePath) {
  return new Promise((resolve) => {
    wx.getFileInfo({
      filePath: filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

/**
 * 批量压缩图片 - 优化性能版本
 * @param {Array} imagePaths 图片路径数组
 * @param {Object} options 压缩选项
 * @returns {Promise} 压缩后的图片路径数组
 */
function compressImages(imagePaths, options = {}) {
  // 限制并发数量以优化性能
  const concurrency = options.concurrency || 3;
  
  return new Promise((resolve, reject) => {
    const results = [];
    let completed = 0;
    let index = 0;
    
    function processNext() {
      if (index >= imagePaths.length) {
        if (completed === imagePaths.length) {
          resolve(results);
        }
        return;
      }
      
      const currentIndex = index++;
      const imagePath = imagePaths[currentIndex];
      
      compressImage(imagePath, options)
        .then((compressedPath) => {
          results[currentIndex] = compressedPath;
          completed++;
          processNext();
        })
        .catch((error) => {
          results[currentIndex] = imagePath; // 失败时使用原图
          completed++;
          processNext();
        });
    }
    
    // 启动并发处理
    for (let i = 0; i < Math.min(concurrency, imagePaths.length); i++) {
      processNext();
    }
  });
}

/**
 * 获取图片信息
 * @param {String} imagePath 图片路径
 * @returns {Promise} 图片信息
 */
function getImageInfo(imagePath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success: (res) => {
        resolve({
          width: res.width,
          height: res.height,
          path: res.path,
          orientation: res.orientation,
          type: res.type
        });
      },
      fail: (error) => {
        reject(new Error('获取图片信息失败: ' + error.errMsg));
      }
    });
  });
}

/**
 * 验证图片大小和格式
 * @param {String} imagePath 图片路径
 * @returns {Promise} 验证结果
 */
function validateImage(imagePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath: imagePath,
      success: (res) => {
        const fileSize = res.size;
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (fileSize > maxSize) {
          reject(new Error('图片大小超过5MB，请选择较小的图片'));
          return;
        }
        
        getImageInfo(imagePath).then((imageInfo) => {
          const supportedTypes = ['jpg', 'jpeg', 'png'];
          const fileType = imageInfo.type.toLowerCase();
          
          if (!supportedTypes.includes(fileType)) {
            reject(new Error('不支持的图片格式，请选择JPG或PNG格式的图片'));
            return;
          }
          
          resolve({
            isValid: true,
            fileSize: fileSize,
            imageInfo: imageInfo
          });
        }).catch(reject);
      },
      fail: (error) => {
        reject(new Error('获取文件信息失败: ' + error.errMsg));
      }
    });
  });
}

/**
 * 显示加载提示
 * @param {String} title 提示文字
 * @param {Boolean} mask 是否显示透明蒙层
 */
function showLoading(title = '加载中...', mask = true) {
  wx.showLoading({
    title: title,
    mask: mask
  });
}

/**
 * 显示带进度的加载提示
 * @param {String} title 提示文字
 * @param {Number} progress 进度百分比 (0-100)
 * @param {String} stage 当前阶段
 */
function showLoadingWithProgress(title = '处理中...', progress = 0, stage = '') {
  const progressText = stage ? `${title}\n${stage} (${progress}%)` : `${title} (${progress}%)`;
  wx.showLoading({
    title: progressText,
    mask: true
  });
}

/**
 * 显示图像识别加载状态
 * @param {String} stage 识别阶段
 */
function showImageRecognitionLoading(stage = 'init') {
  const stages = {
    'init': '正在准备识别...',
    'uploading': '正在上传图片...',
    'processing': '正在分析图像...',
    'recognizing': '正在识别食物...',
    'completing': '识别即将完成...'
  };
  
  const message = stages[stage] || '正在识别食物...';
  showLoading(message, true);
}

/**
 * 显示菜谱生成加载状态
 * @param {String} stage 生成阶段
 * @param {Number} progress 进度百分比
 */
function showRecipeGenerationLoading(stage = 'init', progress = 0) {
  const stages = {
    'init': '正在准备生成菜谱...',
    'analyzing': '正在分析食物特征...',
    'searching': '正在查找传统做法...',
    'generating': '正在生成专业菜谱...',
    'optimizing': '正在优化制作步骤...',
    'nutrition': '正在完善营养信息...',
    'completing': '菜谱即将生成完成...'
  };
  
  const message = stages[stage] || '正在生成菜谱...';
  showLoadingWithProgress(message, progress, '');
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示成功提示
 * @param {String} title 提示文字
 * @param {Number} duration 显示时长
 */
function showSuccess(title, duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: duration
  });
}

/**
 * 显示错误提示
 * @param {String} title 错误信息
 * @param {Number} duration 显示时长
 */
function showError(title, duration = 3000) {
  wx.showToast({
    title: title,
    icon: 'error',
    duration: duration
  });
}

/**
 * 显示普通提示
 * @param {String} title 提示文字
 * @param {Number} duration 显示时长
 */
function showToast(title, duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: duration
  });
}

/**
 * 显示确认对话框
 * @param {String} title 标题
 * @param {String} content 内容
 * @returns {Promise} 用户选择结果
 */
function showConfirm(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: content,
      success: (res) => {
        resolve(res.confirm);
      },
      fail: () => {
        resolve(false);
      }
    });
  });
}

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @param {String} format 格式字符串
 * @returns {String} 格式化后的时间
 */
function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

/**
 * 防抖函数
 * @param {Function} func 要防抖的函数
 * @param {Number} delay 延迟时间
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 节流函数
 * @param {Function} func 要节流的函数
 * @param {Number} delay 节流间隔
 * @returns {Function} 节流后的函数
 */
function throttle(func, delay = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      func.apply(this, args);
    }
  };
}

/**
 * 深拷贝对象
 * @param {*} obj 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 本地缓存管理 - 增强版 (需求5.5)
 */
const CacheManager = {
  // 缓存键前缀
  PREFIX: 'foodiefinder_cache_',
  
  // 默认缓存时间 (毫秒)
  DEFAULT_EXPIRE_TIME: 24 * 60 * 60 * 1000, // 24小时
  
  // 缓存统计
  stats: {
    hits: 0,
    misses: 0,
    sets: 0,
    removes: 0
  },
  
  /**
   * 设置缓存 - 添加本地缓存机制 (需求5.5)
   * @param {String} key 缓存键
   * @param {*} data 缓存数据
   * @param {Number} expireTime 过期时间(毫秒)
   * @param {Object} options 选项
   */
  set(key, data, expireTime = this.DEFAULT_EXPIRE_TIME, options = {}) {
    try {
      const {
        compress = false,
        priority = 'normal' // low, normal, high
      } = options;
      
      const cacheData = {
        data: compress ? this.compressData(data) : data,
        timestamp: Date.now(),
        expireTime: expireTime,
        compressed: compress,
        priority: priority,
        accessCount: 0,
        lastAccess: Date.now()
      };
      
      // 检查存储空间
      if (!this.checkStorageSpace()) {
        this.cleanupByPriority();
      }
      
      wx.setStorageSync(this.PREFIX + key, cacheData);
      this.stats.sets++;
      return true;
    } catch (error) {
      console.warn('缓存设置失败:', error);
      return false;
    }
  },
  
  /**
   * 获取缓存 - 优化缓存性能 (需求5.5)
   * @param {String} key 缓存键
   * @returns {*} 缓存数据，如果不存在或过期返回null
   */
  get(key) {
    try {
      const cacheData = wx.getStorageSync(this.PREFIX + key);
      
      if (!cacheData) {
        this.stats.misses++;
        return null;
      }
      
      // 检查是否过期
      const now = Date.now();
      if (now - cacheData.timestamp > cacheData.expireTime) {
        this.remove(key);
        this.stats.misses++;
        return null;
      }
      
      // 更新访问统计
      cacheData.accessCount = (cacheData.accessCount || 0) + 1;
      cacheData.lastAccess = now;
      
      // 异步更新访问信息（不阻塞获取操作）
      setTimeout(() => {
        try {
          wx.setStorageSync(this.PREFIX + key, cacheData);
        } catch (error) {
          console.warn('更新缓存访问信息失败:', error);
        }
      }, 0);
      
      this.stats.hits++;
      
      // 解压缩数据
      const result = cacheData.compressed ? this.decompressData(cacheData.data) : cacheData.data;
      return result;
    } catch (error) {
      console.warn('缓存获取失败:', error);
      this.stats.misses++;
      return null;
    }
  },
  
  /**
   * 删除缓存
   * @param {String} key 缓存键
   */
  remove(key) {
    try {
      wx.removeStorageSync(this.PREFIX + key);
      this.stats.removes++;
      return true;
    } catch (error) {
      console.warn('缓存删除失败:', error);
      return false;
    }
  },
  
  /**
   * 清空所有缓存
   */
  clear() {
    try {
      const info = wx.getStorageInfoSync();
      const keys = info.keys.filter(key => key.startsWith(this.PREFIX));
      
      keys.forEach(key => {
        wx.removeStorageSync(key);
      });
      
      this.stats.removes += keys.length;
      return true;
    } catch (error) {
      console.warn('缓存清空失败:', error);
      return false;
    }
  },
  
  /**
   * 检查存储空间
   * @returns {Boolean} 是否有足够空间
   */
  checkStorageSpace() {
    try {
      const info = wx.getStorageInfoSync();
      const limitSize = info.limitSize || 10240; // 默认10MB
      const currentSize = info.currentSize || 0;
      
      // 如果使用超过80%，认为空间不足
      return (currentSize / limitSize) < 0.8;
    } catch (error) {
      console.warn('检查存储空间失败:', error);
      return true; // 检查失败时假设有空间
    }
  },
  
  /**
   * 按优先级清理缓存
   */
  cleanupByPriority() {
    try {
      const info = wx.getStorageInfoSync();
      const cacheKeys = info.keys.filter(key => key.startsWith(this.PREFIX));
      
      const cacheItems = [];
      
      // 收集缓存项信息
      cacheKeys.forEach(key => {
        try {
          const cacheData = wx.getStorageSync(key);
          if (cacheData) {
            cacheItems.push({
              key: key,
              priority: cacheData.priority || 'normal',
              lastAccess: cacheData.lastAccess || 0,
              accessCount: cacheData.accessCount || 0,
              timestamp: cacheData.timestamp || 0
            });
          }
        } catch (error) {
          // 损坏的缓存项，直接删除
          wx.removeStorageSync(key);
        }
      });
      
      // 按优先级和访问频率排序
      cacheItems.sort((a, b) => {
        const priorityWeight = { low: 1, normal: 2, high: 3 };
        const aPriority = priorityWeight[a.priority] || 2;
        const bPriority = priorityWeight[b.priority] || 2;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // 低优先级排前面
        }
        
        // 同优先级按访问频率排序
        return a.accessCount - b.accessCount;
      });
      
      // 删除前30%的缓存项
      const deleteCount = Math.floor(cacheItems.length * 0.3);
      for (let i = 0; i < deleteCount; i++) {
        wx.removeStorageSync(cacheItems[i].key);
        this.stats.removes++;
      }
      
      console.log(`缓存清理完成，删除了 ${deleteCount} 个项目`);
    } catch (error) {
      console.warn('缓存清理失败:', error);
    }
  },
  
  /**
   * 压缩数据
   * @param {*} data 原始数据
   * @returns {String} 压缩后的数据
   */
  compressData(data) {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.warn('数据压缩失败:', error);
      return data;
    }
  },
  
  /**
   * 解压缩数据
   * @param {String} compressedData 压缩的数据
   * @returns {*} 解压缩后的数据
   */
  decompressData(compressedData) {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      console.warn('数据解压缩失败:', error);
      return compressedData;
    }
  },
  
  /**
   * 获取缓存大小信息
   */
  getInfo() {
    try {
      const info = wx.getStorageInfoSync();
      const cacheKeys = info.keys.filter(key => key.startsWith(this.PREFIX));
      
      return {
        totalKeys: cacheKeys.length,
        totalSize: info.currentSize,
        limitSize: info.limitSize,
        usagePercentage: Math.round((info.currentSize / info.limitSize) * 100),
        cacheKeys: cacheKeys,
        stats: this.stats,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
      };
    } catch (error) {
      console.warn('获取缓存信息失败:', error);
      return null;
    }
  },
  
  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      hitRatePercentage: `${Math.round(hitRate * 100)}%`
    };
  }
};

/**
 * 性能监控工具 - 增强版 (需求5.5)
 */
const PerformanceMonitor = {
  // 性能记录
  records: new Map(),
  
  // 性能统计
  stats: {
    totalOperations: 0,
    averageTime: 0,
    slowOperations: [],
    fastOperations: []
  },
  
  /**
   * 开始性能监控
   * @param {String} name 监控名称
   * @param {Object} metadata 元数据
   */
  start(name, metadata = {}) {
    this.records.set(name, {
      startTime: Date.now(),
      endTime: null,
      duration: null,
      metadata: metadata,
      memoryUsage: this.getMemoryUsage()
    });
  },
  
  /**
   * 结束性能监控 - 优化API调用的响应时间 (需求5.5)
   * @param {String} name 监控名称
   * @returns {Number} 执行时间(毫秒)
   */
  end(name) {
    const record = this.records.get(name);
    if (!record) {
      console.warn(`性能监控 ${name} 未找到开始记录`);
      return 0;
    }
    
    record.endTime = Date.now();
    record.duration = record.endTime - record.startTime;
    record.endMemoryUsage = this.getMemoryUsage();
    
    // 更新统计信息
    this.updateStats(name, record);
    
    // 性能日志
    const logLevel = record.duration > 3000 ? 'warn' : 'log';
    console[logLevel](`性能监控 [${name}]: ${record.duration}ms`, record.metadata);
    
    // 如果操作过慢，记录到慢操作列表
    if (record.duration > 5000) {
      this.stats.slowOperations.push({
        name,
        duration: record.duration,
        timestamp: record.startTime,
        metadata: record.metadata
      });
      
      // 限制慢操作记录数量
      if (this.stats.slowOperations.length > 20) {
        this.stats.slowOperations = this.stats.slowOperations.slice(-20);
      }
    }
    
    return record.duration;
  },
  
  /**
   * 更新性能统计
   * @param {String} name 操作名称
   * @param {Object} record 性能记录
   */
  updateStats(name, record) {
    this.stats.totalOperations++;
    
    // 计算平均时间
    const totalTime = (this.stats.averageTime * (this.stats.totalOperations - 1)) + record.duration;
    this.stats.averageTime = totalTime / this.stats.totalOperations;
    
    // 记录快速操作
    if (record.duration < 1000) {
      this.stats.fastOperations.push({
        name,
        duration: record.duration,
        timestamp: record.startTime
      });
      
      // 限制快速操作记录数量
      if (this.stats.fastOperations.length > 50) {
        this.stats.fastOperations = this.stats.fastOperations.slice(-50);
      }
    }
  },
  
  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用信息
   */
  getMemoryUsage() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      return {
        platform: systemInfo.platform,
        version: systemInfo.version,
        SDKVersion: systemInfo.SDKVersion
      };
    } catch (error) {
      return { error: 'Unable to get memory info' };
    }
  },
  
  /**
   * 获取性能记录
   * @param {String} name 监控名称
   * @returns {Object} 性能记录
   */
  getRecord(name) {
    return this.records.get(name);
  },
  
  /**
   * 获取性能统计
   * @returns {Object} 性能统计信息
   */
  getStats() {
    return {
      ...this.stats,
      recordCount: this.records.size,
      averageTimeFormatted: `${Math.round(this.stats.averageTime)}ms`
    };
  },
  
  /**
   * 清空所有记录
   */
  clear() {
    this.records.clear();
    this.stats = {
      totalOperations: 0,
      averageTime: 0,
      slowOperations: [],
      fastOperations: []
    };
  },
  
  /**
   * 导出性能报告
   * @returns {Object} 性能报告
   */
  exportReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      recentRecords: Array.from(this.records.entries()).slice(-10),
      recommendations: this.generateRecommendations()
    };
    
    console.log('性能报告:', report);
    return report;
  },
  
  /**
   * 生成性能优化建议
   * @returns {Array} 优化建议列表
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.stats.averageTime > 3000) {
      recommendations.push('平均响应时间较长，建议优化API调用或增加缓存');
    }
    
    if (this.stats.slowOperations.length > 5) {
      recommendations.push('存在多个慢操作，建议检查网络连接或优化算法');
    }
    
    if (this.records.size > 100) {
      recommendations.push('性能记录过多，建议定期清理以节省内存');
    }
    
    return recommendations;
  }
};

module.exports = {
  compressImage,
  compressImages,
  calculateOptimalCompression,
  calculateEstimatedFileSize,
  generateImageCacheKey,
  isFileExists,
  getImageInfo,
  validateImage,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showToast,
  showConfirm,
  formatTime,
  debounce,
  throttle,
  deepClone,
  showLoadingWithProgress,
  showImageRecognitionLoading,
  showRecipeGenerationLoading,
  CacheManager,
  PerformanceMonitor
};