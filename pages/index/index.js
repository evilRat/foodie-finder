const { showLoading, hideLoading, handleError, showImageRecognitionLoading, showLoadingWithProgress, showSuccess, showError, compressImage, CacheManager, PerformanceMonitor } = require('../../utils/util');
const { validateInput, validateImage } = require('../../utils/index');
const { showRetryDialog, showSuccessFeedback, showNetworkErrorDialog, showUnifiedErrorDialog, ERROR_CODES } = require('../../utils/errorHandler');

Page({
  data: {
    inputValue: '',
    imageSrc: '',
    recognizedFood: '',
    isProcessing: false,
    searchHistory: [],
    showHistory: false,
    inputFocused: false,
    // 增强的加载状态和进度提示 - 需求6.1, 6.4
    processingStage: 'init', // init, uploading, processing, recognizing, completing
    processingMessage: '正在准备...',
    processingTip: '请稍候',
    processingProgress: 0,
    processingStartTime: null
  },

  onLoad() {
    // 页面加载时执行
    this.loadSearchHistory();
    this.initializeCacheManagement();
  },

  /**
   * 初始化缓存管理
   */
  initializeCacheManagement() {
    // 检查缓存大小
    const cacheInfo = CacheManager.getInfo();
    if (cacheInfo && cacheInfo.totalKeys > 50) {
      // 如果缓存项目过多，清理旧缓存
      console.log('缓存项目过多，开始清理...');
      this.cleanupOldCache();
    }
  },

  /**
   * 清理旧缓存
   */
  cleanupOldCache() {
    try {
      // 获取所有缓存键
      const info = wx.getStorageInfoSync();
      const cacheKeys = info.keys.filter(key => key.startsWith(CacheManager.PREFIX));
      
      // 按时间排序，删除最旧的缓存
      const cacheData = [];
      cacheKeys.forEach(key => {
        try {
          const data = wx.getStorageSync(key);
          if (data && data.timestamp) {
            cacheData.push({ key, timestamp: data.timestamp });
          }
        } catch (error) {
          // 删除损坏的缓存
          wx.removeStorageSync(key);
        }
      });
      
      // 排序并删除最旧的30%
      cacheData.sort((a, b) => a.timestamp - b.timestamp);
      const deleteCount = Math.floor(cacheData.length * 0.3);
      
      for (let i = 0; i < deleteCount; i++) {
        wx.removeStorageSync(cacheData[i].key);
      }
      
      console.log(`已清理 ${deleteCount} 个旧缓存项目`);
    } catch (error) {
      console.warn('清理缓存失败:', error);
    }
  },

  onShow() {
    // 页面显示时重置状态
    this.setData({
      isProcessing: false,
      showHistory: false
    });
  },

  /**
   * 加载搜索历史
   */
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('searchHistory') || [];
      this.setData({
        searchHistory: history.slice(0, 5) // 只显示最近5条
      });
    } catch (error) {
      console.warn('加载搜索历史失败:', error);
    }
  },

  /**
   * 保存搜索历史
   */
  saveSearchHistory(keyword) {
    try {
      let history = wx.getStorageSync('searchHistory') || [];
      
      // 移除重复项
      history = history.filter(item => item !== keyword);
      
      // 添加到开头
      history.unshift(keyword);
      
      // 限制历史记录数量
      if (history.length > 10) {
        history = history.slice(0, 10);
      }
      
      wx.setStorageSync('searchHistory', history);
      this.setData({
        searchHistory: history.slice(0, 5)
      });
    } catch (error) {
      console.warn('保存搜索历史失败:', error);
    }
  },

  // 输入框内容变化时
  onInput(e) {
    const value = e.detail.value;
    this.setData({
      inputValue: value,
      showHistory: value.length === 0 && this.data.inputFocused && this.data.searchHistory.length > 0
    });
  },

  // 输入框获得焦点
  onInputFocus() {
    this.setData({
      inputFocused: true,
      showHistory: this.data.inputValue.length === 0 && this.data.searchHistory.length > 0
    });
  },

  // 输入框失去焦点
  onInputBlur() {
    // 延迟隐藏历史记录，避免点击历史记录时立即隐藏
    setTimeout(() => {
      this.setData({
        inputFocused: false,
        showHistory: false
      });
    }, 200);
  },

  // 选择历史记录
  selectHistory(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      inputValue: keyword,
      showHistory: false
    });
    this.searchByInput();
  },

  // 清空输入框
  clearInput() {
    this.setData({
      inputValue: '',
      showHistory: this.data.inputFocused && this.data.searchHistory.length > 0
    });
  },

  // 清空搜索历史
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({
            searchHistory: [],
            showHistory: false
          });
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  // 拍照识别
  takePhoto() {
    // 检查设备是否支持相机
    wx.getSystemInfo({
      success: (systemInfo) => {
        // 检查相机权限
        wx.getSetting({
          success: (res) => {
            if (res.authSetting['scope.camera'] === false) {
              this.showCameraPermissionModal();
              return;
            }
            
            // 如果未授权过，直接调用相机（会自动请求权限）
            this.chooseImageFromCamera();
          },
          fail: (error) => {
            console.error('获取设置失败:', error);
            handleError(error, '获取权限设置失败');
          }
        });
      },
      fail: (error) => {
        console.error('获取系统信息失败:', error);
        wx.showToast({
          title: '设备不支持相机功能',
          icon: 'none'
        });
      }
    });
  },

  // 显示相机权限提示
  showCameraPermissionModal() {
    wx.showModal({
      title: '需要相机权限',
      content: '识食有方需要使用相机来拍摄食物照片，请在设置中开启相机权限',
      confirmText: '去设置',
      cancelText: '取消',
      success: (modalRes) => {
        if (modalRes.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              if (settingRes.authSetting['scope.camera']) {
                wx.showToast({
                  title: '权限已开启',
                  icon: 'success'
                });
              }
            }
          });
        }
      }
    });
  },

  // 从相机选择图片
  chooseImageFromCamera() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera'],
      sizeType: ['compressed'], // 使用压缩图片，减少文件大小
      success: (res) => {
        const imagePath = res.tempFilePaths[0];
        
        // 开始性能监控
        PerformanceMonitor.start('camera_image_processing');
        
        // 获取图片信息进行验证
        wx.getImageInfo({
          src: imagePath,
          success: async (imageInfo) => {
            // 验证图片大小和格式
            const validation = this.validateCameraImage(imageInfo);
            if (!validation.valid) {
              wx.showToast({
                title: validation.message,
                icon: 'none',
                duration: 2000
              });
              return;
            }
            
            this.setData({
              imageSrc: imagePath,
              isProcessing: true,
              processingStage: 'init',
              processingMessage: '正在准备识别...',
              processingTip: '初始化图像识别服务',
              processingProgress: 0
            });
            
            showImageRecognitionLoading('init');
            
            try {
              // 智能压缩图片
              this.setData({
                processingStage: 'uploading',
                processingMessage: '正在处理图片...',
                processingTip: '优化图片质量以提高识别准确度',
                processingProgress: 15
              });
              showImageRecognitionLoading('uploading');
              const compressedPath = await compressImage(imagePath, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 85
              });
              
              PerformanceMonitor.end('camera_image_processing');
              this.processImageRecognition(compressedPath, 'camera');
            } catch (error) {
              console.warn('图片压缩失败，使用原图:', error);
              this.processImageRecognition(imagePath, 'camera');
            }
          },
          fail: (error) => {
            console.error('获取图片信息失败:', error);
            handleError(error, '图片处理失败');
          }
        });
      },
      fail: (error) => {
        console.error('拍照失败:', error);
        
        // 根据错误类型给出不同提示
        let errorMessage = '拍照失败，请重试';
        if (error.errMsg && error.errMsg.includes('cancel')) {
          errorMessage = '已取消拍照';
        } else if (error.errMsg && error.errMsg.includes('auth')) {
          errorMessage = '相机权限被拒绝';
        }
        
        if (!error.errMsg || !error.errMsg.includes('cancel')) {
          handleError(error, errorMessage);
        }
      }
    });
  },

  // 验证相机拍摄的图片
  validateCameraImage(imageInfo) {
    // 检查图片尺寸
    if (imageInfo.width < 100 || imageInfo.height < 100) {
      return {
        valid: false,
        message: '图片尺寸太小，请重新拍摄'
      };
    }
    
    // 检查图片格式
    const validTypes = ['jpeg', 'jpg', 'png', 'webp'];
    const imageType = imageInfo.type ? imageInfo.type.toLowerCase() : '';
    
    if (imageType && !validTypes.includes(imageType)) {
      return {
        valid: false,
        message: '不支持的图片格式'
      };
    }
    
    return {
      valid: true,
      message: '验证通过'
    };
  },

  // 从相册选择
  chooseFromAlbum() {
    // 检查相册权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum'] === false) {
          // 注意：读取相册不需要特殊权限，这里主要是为了完整性检查
        }
        
        this.chooseImageFromAlbum();
      },
      fail: (error) => {
        console.error('获取设置失败:', error);
        // 即使获取设置失败，也尝试选择图片
        this.chooseImageFromAlbum();
      }
    });
  },

  // 从相册选择图片
  chooseImageFromAlbum() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album'],
      sizeType: ['compressed'], // 使用压缩图片
      success: (res) => {
        const imagePath = res.tempFilePaths[0];
        
        // 开始性能监控
        PerformanceMonitor.start('album_image_processing');
        
        // 获取图片详细信息
        wx.getImageInfo({
          src: imagePath,
          success: async (imageInfo) => {
            // 验证图片
            const validation = this.validateAlbumImage(imageInfo, imagePath);
            if (!validation.valid) {
              wx.showToast({
                title: validation.message,
                icon: 'none',
                duration: 2000
              });
              return;
            }
            
            this.setData({
              imageSrc: imagePath,
              isProcessing: true,
              processingStage: 'init',
              processingMessage: '正在准备识别...',
              processingTip: '初始化图像识别服务',
              processingProgress: 0
            });
            
            showImageRecognitionLoading('init');
            
            try {
              // 智能压缩图片
              this.setData({
                processingStage: 'uploading',
                processingMessage: '正在处理图片...',
                processingTip: '优化图片质量以提高识别准确度',
                processingProgress: 15
              });
              showImageRecognitionLoading('uploading');
              const compressedPath = await compressImage(imagePath, {
                maxWidth: 1024,
                maxHeight: 1024,
                maxFileSize: 500 * 1024, // 500KB
                quality: 80
              });
              
              PerformanceMonitor.end('album_image_processing');
              this.processImageRecognition(compressedPath, 'album');
            } catch (error) {
              console.warn('图片压缩失败，使用原图:', error);
              this.processImageRecognition(imagePath, 'album');
            }
          },
          fail: (error) => {
            console.error('获取图片信息失败:', error);
            wx.showToast({
              title: '图片格式不支持',
              icon: 'none'
            });
          }
        });
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        
        // 根据错误类型给出不同提示
        let errorMessage = '选择图片失败，请重试';
        if (error.errMsg && error.errMsg.includes('cancel')) {
          // 用户取消选择，不显示错误提示
          return;
        } else if (error.errMsg && error.errMsg.includes('auth')) {
          errorMessage = '相册权限被拒绝';
        } else if (error.errMsg && error.errMsg.includes('limit')) {
          errorMessage = '图片大小超出限制';
        }
        
        handleError(error, errorMessage);
      }
    });
  },

  // 验证相册图片
  validateAlbumImage(imageInfo, imagePath) {
    // 检查图片尺寸
    if (imageInfo.width < 100 || imageInfo.height < 100) {
      return {
        valid: false,
        message: '图片尺寸太小，请选择更清晰的图片'
      };
    }
    
    // 检查图片尺寸上限
    if (imageInfo.width > 4096 || imageInfo.height > 4096) {
      return {
        valid: false,
        message: '图片尺寸过大，请选择较小的图片'
      };
    }
    
    // 检查图片格式
    const validTypes = ['jpeg', 'jpg', 'png', 'webp'];
    const imageType = imageInfo.type ? imageInfo.type.toLowerCase() : '';
    
    if (imageType && !validTypes.includes(imageType)) {
      return {
        valid: false,
        message: '请选择JPG、PNG或WEBP格式的图片'
      };
    }
    
    // 检查文件路径
    if (!imagePath || imagePath.length === 0) {
      return {
        valid: false,
        message: '图片路径无效'
      };
    }
    
    // 估算文件大小（基于尺寸）
    const estimatedSize = (imageInfo.width * imageInfo.height * 3) / (1024 * 1024); // MB
    if (estimatedSize > 5) {
      return {
        valid: false,
        message: '图片文件过大，请选择5MB以下的图片'
      };
    }
    
    return {
      valid: true,
      message: '验证通过'
    };
  },

  // 压缩图片（如果需要）
  compressImageIfNeeded(imagePath, callback) {
    wx.getImageInfo({
      src: imagePath,
      success: (imageInfo) => {
        // 如果图片太大，进行压缩
        if (imageInfo.width > 1024 || imageInfo.height > 1024) {
          // 计算压缩比例
          const maxSize = 1024;
          const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
          
          wx.canvasToTempFilePath({
            width: imageInfo.width * ratio,
            height: imageInfo.height * ratio,
            destWidth: imageInfo.width * ratio,
            destHeight: imageInfo.height * ratio,
            fileType: 'jpg',
            quality: 0.8,
            success: (res) => {
              callback(res.tempFilePath);
            },
            fail: () => {
              // 压缩失败，使用原图
              callback(imagePath);
            }
          });
        } else {
          // 不需要压缩
          callback(imagePath);
        }
      },
      fail: () => {
        // 获取信息失败，使用原图
        callback(imagePath);
      }
    });
  },

  // 处理图像识别
  processImageRecognition(imagePath, source = 'image') {
    // 记录识别开始时间
    const startTime = Date.now();
    
    // TODO: 这里将在后续任务中集成真实的AI识别服务
    // 目前使用模拟数据和逻辑
    
    // 模拟识别过程的各个阶段
    this.simulateRecognitionProgress(imagePath, source, startTime);
  },

  // 模拟识别进度 - 增强的加载状态和进度提示 (需求6.1, 6.4)
  simulateRecognitionProgress(imagePath, source, startTime) {
    const stages = [
      { 
        stage: 'uploading', 
        delay: 800, 
        message: '正在上传图片...', 
        tip: '图片上传中，请保持网络连接',
        progress: 25
      },
      { 
        stage: 'processing', 
        delay: 1200, 
        message: '正在分析图像...', 
        tip: 'AI正在分析图像内容和特征',
        progress: 50
      },
      { 
        stage: 'recognizing', 
        delay: 1500, 
        message: '正在识别食物...', 
        tip: '智能识别食物种类和特征',
        progress: 75
      },
      { 
        stage: 'completing', 
        delay: 600, 
        message: '识别即将完成...', 
        tip: '正在整理识别结果',
        progress: 95
      }
    ];
    
    let currentStage = 0;
    
    const processStage = () => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        
        // 更新页面状态 - 需求6.1: 显示加载状态指示器
        this.setData({
          processingStage: stage.stage,
          processingMessage: stage.message, // 需求6.4: 显示进度提示文字
          processingTip: stage.tip,
          processingProgress: stage.progress
        });
        
        // 显示系统级加载提示
        showImageRecognitionLoading(stage.stage);
        
        // 记录进度日志
        console.log(`图像识别进度: ${stage.progress}% - ${stage.message}`);
        
        setTimeout(() => {
          currentStage++;
          processStage();
        }, stage.delay);
      } else {
        // 所有阶段完成，开始最终识别
        this.completeImageRecognition(imagePath, source, startTime);
      }
    };
    
    // 初始化进度状态
    this.setData({
      processingStartTime: startTime,
      processingProgress: 0,
      processingStage: 'init',
      processingMessage: '正在准备识别...',
      processingTip: '初始化图像识别服务'
    });
    
    processStage();
  },

  // 完成图像识别
  completeImageRecognition(imagePath, source, startTime) {
    setTimeout(() => {
      try {
        // 模拟识别成功率（90%成功率）
        const isSuccess = Math.random() > 0.1;
        
        if (!isSuccess) {
          // 模拟识别失败
          hideLoading();
          this.setData({
            isProcessing: false
          });
          
          this.handleRecognitionFailure(source, new Error('识别失败'));
          return;
        }
        
        // 模拟识别成功
        const mockResults = [
          { name: '红烧肉', confidence: 0.95 },
          { name: '宫保鸡丁', confidence: 0.88 },
          { name: '麻婆豆腐', confidence: 0.92 },
          { name: '糖醋里脊', confidence: 0.85 },
          { name: '鱼香肉丝', confidence: 0.90 },
          { name: '回锅肉', confidence: 0.87 },
          { name: '水煮鱼', confidence: 0.93 }
        ];
        
        const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
        const processingTime = Date.now() - startTime;
        
        // 显示完成状态 - 需求6.1, 6.4
        this.setData({
          processingStage: 'completing',
          processingMessage: '识别完成！',
          processingTip: `成功识别为: ${randomResult.name}`,
          processingProgress: 100
        });
        
        hideLoading();
        
        this.setData({
          recognizedFood: randomResult.name,
          isProcessing: false
        });
        
        // 记录识别结果
        this.recordRecognitionResult({
          foodName: randomResult.name,
          confidence: randomResult.confidence,
          processingTime: processingTime,
          source: source,
          success: true
        });
        
        // 显示识别结果提示
        showSuccessFeedback(`识别成功: ${randomResult.name}`, {
          duration: 1500
        });
        
        // 延迟跳转，让用户看到识别结果
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/recipe/recipe?food=${encodeURIComponent(randomResult.name)}&source=${source}&confidence=${randomResult.confidence}`,
            success: () => {
              // 清理图片缓存
              this.setData({
                imageSrc: '',
                recognizedFood: ''
              });
            },
            fail: (error) => {
              console.error('页面跳转失败:', error);
              handleError(error, '页面跳转失败');
            }
          });
        }, 1000);
        
      } catch (error) {
        console.error('图像识别处理失败:', error);
        hideLoading();
        this.setData({
          isProcessing: false
        });
        this.handleRecognitionFailure(source, error);
      }
    }, recognitionDelay);
  },

  // 处理识别失败 - 增强的错误处理和用户反馈 (需求6.2, 6.3)
  async handleRecognitionFailure(source, error = null) {
    // 使用统一的错误处理界面 - 需求6.2: 创建统一的错误提示界面
    try {
      const action = await showUnifiedErrorDialog(error || new Error('RECOGNITION_FAILED'), {
        title: '图片识别失败',
        showRetry: true,
        showCancel: true,
        retryText: source === 'camera' ? '重新拍照' : '重新选择',
        cancelText: '手动输入',
        context: 'image-recognition'
      });
      
      // 需求6.3: 实现网络错误的重试功能
      if (action === 'retry') {
        // 显示重试反馈
        showSuccessFeedback('正在重新尝试...', {
          type: 'info',
          duration: 1500
        });
        
        // 重新尝试
        setTimeout(() => {
          if (source === 'camera') {
            this.takePhoto();
          } else {
            this.chooseFromAlbum();
          }
        }, 1500);
      } else {
        // 切换到手动输入模式
        this.switchToManualInput();
      }
    } catch (dialogError) {
      console.error('显示错误对话框失败:', dialogError);
      // 降级处理
      this.showFormatErrorFeedback();
    }
  },

  // 显示格式错误反馈
  showFormatErrorFeedback() {
    wx.showModal({
      title: '图片格式不支持',
      content: '请选择JPG、PNG或WEBP格式的图片。建议使用相机直接拍照获得最佳识别效果。',
      confirmText: '重新选择',
      cancelText: '拍照',
      success: (res) => {
        if (res.confirm) {
          this.chooseFromAlbum();
        } else {
          this.takePhoto();
        }
      }
    });
  },

  // 切换到手动输入模式
  switchToManualInput() {
    showSuccessFeedback('已切换到手动输入模式', {
      duration: 1500,
      callback: () => {
        // 聚焦到搜索框
        this.setData({
          inputFocused: true,
          showHistory: this.data.searchHistory.length > 0
        });
      }
    });
  },

  // 记录识别结果
  recordRecognitionResult(result) {
    try {
      let recognitionHistory = wx.getStorageSync('recognitionHistory') || [];
      
      const record = {
        ...result,
        timestamp: Date.now()
      };
      
      recognitionHistory.unshift(record);
      
      // 限制历史记录数量
      if (recognitionHistory.length > 100) {
        recognitionHistory = recognitionHistory.slice(0, 100);
      }
      
      wx.setStorageSync('recognitionHistory', recognitionHistory);
    } catch (error) {
      console.warn('记录识别历史失败:', error);
    }
  },

  // 根据文字搜索
  searchByInput() {
    const keyword = this.data.inputValue.trim();
    
    // 输入验证
    const validation = validateInput(keyword);
    if (!validation.valid) {
      wx.showToast({
        title: validation.message,
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 开始性能监控
    PerformanceMonitor.start('text_search');
    
    // 检查缓存
    const cacheKey = `search_${keyword}`;
    const cachedResult = CacheManager.get(cacheKey);
    
    if (cachedResult) {
      console.log('使用缓存的搜索结果:', keyword);
      PerformanceMonitor.end('text_search');
      
      // 保存搜索历史
      this.saveSearchHistory(keyword);
      
      // 直接跳转，使用缓存的菜谱ID
      wx.navigateTo({
        url: `/pages/recipe/recipe?food=${encodeURIComponent(keyword)}&source=search&cached=true&recipeId=${cachedResult.recipeId}`,
        success: () => {
          this.setData({
            inputValue: '',
            showHistory: false
          });
        }
      });
      return;
    }
    
    // 显示搜索加载状态
    showLoadingWithProgress('正在搜索菜谱...', 20, '准备搜索');
    
    // 保存搜索历史
    this.saveSearchHistory(keyword);
    
    // 模拟搜索延迟，实际项目中这里会调用API
    setTimeout(() => {
      hideLoading();
      PerformanceMonitor.end('text_search');
      
      // 生成菜谱ID用于缓存
      const recipeId = Date.now().toString();
      
      // 缓存搜索结果
      CacheManager.set(cacheKey, {
        keyword: keyword,
        recipeId: recipeId,
        timestamp: Date.now()
      }, 2 * 60 * 60 * 1000); // 缓存2小时
      
      // 跳转到菜谱页面
      wx.navigateTo({
        url: `/pages/recipe/recipe?food=${encodeURIComponent(keyword)}&source=search&recipeId=${recipeId}`,
        success: () => {
          // 清空输入框
          this.setData({
            inputValue: '',
            showHistory: false
          });
        },
        fail: (error) => {
          console.error('页面跳转失败:', error);
          handleError(error, '页面跳转失败，请重试');
        }
      });
    }, 500);
  },

  // 搜索建议功能
  getSearchSuggestions(keyword) {
    // 这里可以实现搜索建议功能
    // 根据输入的关键词返回相关的食物建议
    const suggestions = [
      '红烧肉', '宫保鸡丁', '麻婆豆腐', '糖醋里脊', '鱼香肉丝',
      '回锅肉', '水煮鱼', '口水鸡', '蒜蓉西兰花', '清蒸鲈鱼'
    ];
    
    return suggestions.filter(item => 
      item.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 5);
  },

  // 快速搜索按钮
  quickSearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      inputValue: keyword
    });
    this.searchByInput();
  }
});