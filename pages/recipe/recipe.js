const { showError, showRecipeGenerationLoading, CacheManager, PerformanceMonitor } = require('../../utils/util');
const { smartGenerateRecipe } = require('../../utils/recipeGenerator');
const { showSuccessFeedback, showNetworkErrorDialog, showUnifiedErrorDialog } = require('../../utils/errorHandler');

Page({
  data: {
    // 基本状态
    foodName: '',
    recipe: null,
    loading: true,
    source: 'search', // search, image, cache, retry
    error: null,
    
    // 加载状态管理 - 需求6.1, 6.4
    loadingStage: 'init', // init, analyzing, searching, generating, optimizing, nutrition, completing, complete, error
    loadingProgress: 0,
    loadingMessage: '正在准备...', // 需求6.4: 显示进度提示文字
    
    // 页面状态管理
    pageReady: false,
    retryCount: 0,
    maxRetries: 3,
    
    // 数据状态管理 - 管理菜谱数据的本地状态
    lastUpdated: null, // 最后更新时间
    lastError: null, // 最后错误信息
    fromCache: false, // 是否来自缓存
    regenerate: false, // 是否强制重新生成
    
    // 用户偏好
    userPreferences: null,
    
    // 性能监控
    loadingStartTime: null,
    loadingEndTime: null
  },

  onLoad(options) {
    console.log('Recipe page loaded with options:', options);
    
    // 初始化页面状态
    this.initializePage(options);
  },

  onShow() {
    // 页面显示时检查是否需要刷新数据
    if (this.data.pageReady && this.data.error) {
      // 如果之前有错误，可以提供重试选项
      this.showRetryOption();
    }
    
    // 任务4.2: 页面显示时同步状态
    this.syncStateToStorage();
    
    // 验证当前数据状态
    const validation = this.validateDataState();
    if (!validation.isValid) {
      console.warn('数据状态验证失败:', validation.issues);
    }
    if (validation.warnings.length > 0) {
      console.warn('数据状态警告:', validation.warnings);
    }
  },

  onHide() {
    // 页面隐藏时清理定时器
    this.clearLoadingTimer();
  },

  onUnload() {
    // 页面卸载时清理资源
    this.clearLoadingTimer();
  },

  /**
   * 初始化页面 - 处理从首页传递的参数和菜谱生成请求 (需求4.1, 4.2)
   * @param {Object} options 页面参数
   */
  initializePage(options) {
    console.log('初始化菜谱页面，接收参数:', options);
    
    // 任务4.2: 处理从首页传递的参数和菜谱生成请求
    // 验证必需参数 - 处理从首页传递的参数
    if (!options || !options.food) {
      this.handlePageError('缺少食物名称参数', 'INVALID_PARAMS');
      return;
    }

    // 记录参数处理开始时间 - 本地状态管理
    this.setData({
      parameterProcessingStartTime: Date.now()
    });

    try {
      // 解析页面参数 - 处理从首页传递的参数
      let foodName;
      try {
        foodName = decodeURIComponent(options.food);
      } catch (decodeError) {
        console.warn('URL解码失败，使用原始参数:', decodeError);
        foodName = options.food;
      }
      
      const source = options.source || 'search'; // search, image, cache
      const recipeId = options.recipeId || null;
      const fromCache = options.fromCache === 'true';
      const regenerate = options.regenerate === 'true';
      
      // 验证食物名称
      if (!foodName || typeof foodName !== 'string' || foodName.trim().length === 0) {
        this.handlePageError('食物名称不能为空', 'INVALID_FOOD_NAME');
        return;
      }

      // 验证来源参数
      const validSources = ['search', 'image', 'cache', 'retry'];
      const validatedSource = validSources.includes(source) ? source : 'search';

      // 任务4.2: 管理菜谱数据的本地状态 - 设置基本数据和状态管理
      this.setData({
        foodName: foodName.trim(),
        source: validatedSource,
        pageReady: true,
        loadingStage: 'init',
        loadingMessage: '正在准备生成菜谱...', // 需求6.4: 显示进度提示文字
        fromCache: fromCache,
        regenerate: regenerate,
        // 重置错误状态
        error: null,
        retryCount: 0,
        lastError: null,
        // 任务4.2: 增强的本地状态管理
        parameterProcessingTime: Date.now() - this.data.parameterProcessingStartTime,
        pageInitializedAt: Date.now(),
        stateHistory: [], // 状态变更历史
        // 任务4.2: 增强的参数处理状态管理
        parameterValidation: {
          foodNameValid: true,
          sourceValid: true,
          parametersProcessed: true,
          processingTime: Date.now() - this.data.parameterProcessingStartTime
        },
        // 数据加载状态初始化
        dataLoadingState: {
          initialized: true,
          parametersReady: true,
          cacheChecked: false,
          requestSent: false,
          responseReceived: false,
          dataValidated: false
        }
      });

      // 设置页面标题 (需求4.1: 显示菜谱基本信息)
      wx.setNavigationBarTitle({
        title: `${foodName.trim()} - 菜谱`
      });

      // 记录页面访问
      this.recordPageAccess(foodName.trim(), validatedSource);

      // 加载用户偏好，然后开始菜谱生成请求
      this.loadUserPreferences().then(() => {
        // 开始加载菜谱 - 处理菜谱生成请求
        this.loadRecipe(foodName.trim(), validatedSource, recipeId);
      }).catch((error) => {
        console.warn('加载用户偏好失败，使用默认设置:', error);
        // 即使偏好加载失败，也继续加载菜谱
        this.loadRecipe(foodName.trim(), validatedSource, recipeId);
      });

    } catch (error) {
      console.error('页面初始化失败:', error);
      this.handlePageError('页面初始化失败: ' + error.message, 'INIT_ERROR');
    }
  },

  /**
   * 加载用户偏好设置
   * @returns {Promise}
   */
  loadUserPreferences() {
    return new Promise((resolve) => {
      try {
        const preferences = wx.getStorageSync('userPreferences') || {
          preferredCuisine: '',
          preferredDifficulty: '',
          dietaryRestrictions: [],
          spiceLevel: 'medium'
        };
        
        this.setData({ userPreferences: preferences });
        resolve(preferences);
      } catch (error) {
        console.warn('加载用户偏好失败:', error);
        resolve({});
      }
    });
  },

  /**
   * 加载菜谱数据 - 管理菜谱数据的本地状态 (需求4.1, 4.2, 6.1, 6.4)
   * @param {String} foodName 食物名称
   * @param {String} source 来源类型
   * @param {String} recipeId 菜谱ID（可选）
   */
  loadRecipe(foodName, source = 'search', recipeId = null) {
    console.log('开始加载菜谱:', { foodName, source, recipeId });
    
    // 任务4.2: 处理菜谱生成请求 - 验证输入参数
    if (!foodName || typeof foodName !== 'string') {
      this.handlePageError('无效的食物名称', 'INVALID_FOOD_NAME');
      return;
    }

    // 任务4.2: 记录菜谱生成请求的详细信息
    this.recordRecipeGenerationRequest(foodName, source, recipeId);
    
    // 开始性能监控
    PerformanceMonitor.start('recipe_generation');
    
    // 管理本地状态 - 检查缓存
    const cacheKey = `recipe_${foodName.toLowerCase().replace(/\s+/g, '_')}`;
    let cachedRecipe = null;
    
    try {
      cachedRecipe = CacheManager.get(cacheKey);
    } catch (cacheError) {
      console.warn('缓存读取失败:', cacheError);
    }
    
    // 如果有缓存且不是强制重新生成，使用缓存数据
    if (cachedRecipe && source !== 'retry' && !this.data.regenerate) {
      console.log('使用缓存的菜谱:', foodName);
      PerformanceMonitor.end('recipe_generation');
      
      // 处理缓存数据
      this.handleRecipeSuccess(cachedRecipe, 'cache', foodName);
      
      // 记录缓存使用
      this.recordCacheUsage(foodName);
      return;
    }
    
    // 任务4.2: 实现加载状态显示和错误处理 - 重置加载状态 (需求6.1)
    this.setData({ 
      loading: true,
      error: null,
      loadingStage: 'generating',
      loadingProgress: 10,
      loadingMessage: '正在生成菜谱...', // 需求6.4: 显示进度提示文字
      recipe: null, // 清除之前的菜谱数据
      lastError: null,
      loadingStartTime: Date.now(),
      // 任务4.2: 增强的加载状态管理
      loadingStateHistory: [...(this.data.loadingStateHistory || []), {
        stage: 'generating',
        timestamp: Date.now(),
        message: '开始生成菜谱'
      }],
      // 任务4.2: 增强的数据加载状态跟踪
      dataLoadingState: {
        ...this.data.dataLoadingState,
        cacheChecked: !!cachedRecipe,
        requestSent: true,
        requestTimestamp: Date.now(),
        usingCache: !!cachedRecipe && source !== 'retry' && !this.data.regenerate
      }
    });
    
    // 开始加载进度动画 - 需求6.4: 在生成过程中显示进度提示文字
    this.startLoadingProgress();
    
    // 生成选项配置
    const generationOptions = {
      userPreferences: this.data.userPreferences || {},
      enableCache: true,
      forceRegenerate: source === 'retry' || this.data.regenerate,
      timeout: 30000, // 30秒超时 (需求5.5)
      source: source,
      recipeId: recipeId
    };

    // 调用智能菜谱生成服务
    smartGenerateRecipe(foodName, generationOptions)
      .then((result) => {
        PerformanceMonitor.end('recipe_generation');
        // 处理成功结果并更新本地状态
        this.handleRecipeSuccess(result.data, source, foodName);
      })
      .catch((error) => {
        PerformanceMonitor.end('recipe_generation');
        console.error('菜谱生成失败，尝试使用模拟数据:', error);
        
        // 如果API调用失败，使用模拟数据作为备选方案
        try {
          const mockRecipe = this.generateMockRecipe(foodName, source);
          console.log('使用模拟菜谱数据:', mockRecipe);
          this.handleRecipeSuccess(mockRecipe, source, foodName);
        } catch (mockError) {
          console.error('模拟数据生成也失败:', mockError);
          // 处理错误并更新本地状态
          this.handleRecipeError(error, foodName, source);
        }
      });
  },

  /**
   * 开始加载进度动画 - 需求6.1和6.4: 显示加载状态指示器和进度提示文字
   */
  startLoadingProgress() {
    this.clearLoadingTimer();
    
    // 定义加载阶段 - 需求6.4: 在识别或生成过程中显示进度提示文字
    const stages = [
      { progress: 15, message: '正在分析食物特征...', stage: 'analyzing', duration: 1500 },
      { progress: 30, message: '正在查找传统做法...', stage: 'searching', duration: 2000 },
      { progress: 50, message: '正在生成专业菜谱...', stage: 'generating', duration: 3000 },
      { progress: 70, message: '正在优化制作步骤...', stage: 'optimizing', duration: 2500 },
      { progress: 85, message: '正在完善营养信息...', stage: 'nutrition', duration: 2000 },
      { progress: 95, message: '菜谱即将生成完成...', stage: 'completing', duration: 1000 }
    ];
    
    let currentStage = 0;
    
    const updateProgress = () => {
      // 检查是否仍在加载状态
      if (currentStage < stages.length && this.data.loading) {
        const stage = stages[currentStage];
        
        // 更新页面状态 - 需求6.1: 显示加载状态指示器
        this.setData({
          loadingProgress: stage.progress,
          loadingMessage: stage.message, // 需求6.4: 显示进度提示文字
          loadingStage: stage.stage
        });
        
        // 显示系统级加载提示 - 需求6.1: 加载状态指示器
        try {
          showRecipeGenerationLoading(stage.stage, stage.progress);
        } catch (error) {
          console.warn('显示加载提示失败:', error);
        }
        
        // 记录进度日志
        console.log(`加载进度: ${stage.progress}% - ${stage.message}`);
        
        // 设置下一阶段的定时器
        this.loadingTimer = setTimeout(() => {
          currentStage++;
          updateProgress();
        }, stage.duration);
      }
    };
    
    // 开始进度更新
    updateProgress();
  },

  /**
   * 清理加载定时器
   */
  clearLoadingTimer() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
  },

  /**
   * 处理菜谱生成成功 - 更新本地状态 (需求4.1, 6.4)
   * @param {Object} recipeData 菜谱数据
   * @param {String} source 来源
   * @param {String} foodName 食物名称
   */
  handleRecipeSuccess(recipeData, source, foodName = null) {
    console.log('菜谱生成成功，更新本地状态:', { foodName, source });
    
    // 清理加载定时器
    this.clearLoadingTimer();
    
    try {
      // 验证菜谱数据完整性 (需求4.1: 显示菜谱基本信息)
      const validatedRecipe = this.validateRecipeData(recipeData);
      
      // 格式化时间戳用于显示
      const now = new Date();
      const timeString = now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // 任务4.2: 管理菜谱数据的本地状态 - 更新本地状态
      this.setData({
        recipe: validatedRecipe,
        loading: false,
        loadingStage: 'complete',
        loadingProgress: 100,
        loadingMessage: '菜谱生成完成！', // 需求6.4: 显示进度提示文字
        error: null,
        lastUpdated: timeString,
        fromCache: source === 'cache',
        // 任务4.2: 增强的本地状态管理
        loadingEndTime: Date.now(),
        totalLoadingTime: Date.now() - this.data.loadingStartTime,
        recipeLoadedAt: Date.now(),
        dataSource: source,
        recipeVersion: validatedRecipe.id || Date.now().toString(),
        // 任务4.2: 完整的数据加载状态更新
        dataLoadingState: {
          ...this.data.dataLoadingState,
          responseReceived: true,
          dataValidated: true,
          loadingCompleted: true,
          completionTimestamp: Date.now()
        },
        // 数据质量指标
        dataQuality: {
          hasName: !!validatedRecipe.name,
          hasIngredients: validatedRecipe.ingredients && validatedRecipe.ingredients.length > 0,
          hasSteps: validatedRecipe.steps && validatedRecipe.steps.length > 0,
          hasTips: validatedRecipe.tips && validatedRecipe.tips.length > 0,
          hasNutrition: !!validatedRecipe.nutrition,
          completenessScore: this.calculateDataCompleteness(validatedRecipe)
        }
      });
      
      // 缓存菜谱数据 - 本地状态管理
      const targetFoodName = foodName || this.data.foodName;
      if (targetFoodName && source !== 'cache') {
        try {
          const cacheKey = `recipe_${targetFoodName}`;
          const cacheData = {
            ...validatedRecipe,
            cachedAt: Date.now(),
            source: source
          };
          CacheManager.set(cacheKey, cacheData, 4 * 60 * 60 * 1000); // 缓存4小时
          console.log('菜谱已缓存到本地存储:', targetFoodName);
        } catch (cacheError) {
          console.warn('缓存菜谱失败:', cacheError);
        }
      }
      
      // 记录成功生成
      this.recordRecipeSuccess(validatedRecipe, source);
      
      // 任务4.2: 同步状态到持久化存储
      this.syncStateToStorage();
      
      // 需求6.4: 在操作完成后提供成功确认反馈
      const successMessage = source === 'cache' ? '菜谱加载成功（来自缓存）' : '菜谱生成成功！';
      showSuccessFeedback(successMessage, {
        duration: 1500
      });
      
      // 更新页面标题显示菜谱名称 (需求4.1)
      if (validatedRecipe.name) {
        wx.setNavigationBarTitle({
          title: `${validatedRecipe.name} - 菜谱`
        });
      }
      
      console.log('菜谱数据已成功加载到本地状态:', validatedRecipe);
      
      // 任务4.2: 验证最终数据状态
      const finalValidation = this.validateDataState();
      if (finalValidation.isValid) {
        console.log('数据状态验证通过，完整性评分:', this.data.dataQuality?.completenessScore || 0);
      } else {
        console.warn('最终数据状态验证失败:', finalValidation.issues);
      }
      
    } catch (validationError) {
      console.error('菜谱数据验证失败:', validationError);
      // 如果验证失败，当作错误处理
      this.handleRecipeError(validationError, foodName || this.data.foodName, source);
    }
  },

  /**
   * 处理菜谱生成错误 - 错误处理和状态管理 (需求6.1, 6.2, 6.3)
   * @param {Error} error 错误对象
   * @param {String} foodName 食物名称
   * @param {String} source 来源
   */
  async handleRecipeError(error, foodName, source) {
    console.error('菜谱生成失败，更新错误状态:', { error: error.message, foodName, source });
    
    // 清理加载定时器
    this.clearLoadingTimer();
    
    const retryCount = this.data.retryCount + 1;
    const canRetry = retryCount < this.data.maxRetries;
    
    // 错误分类处理 - 需求6.2: 在网络请求失败时显示错误提示信息
    let errorMessage = '生成菜谱失败';
    let errorCode = 'UNKNOWN_ERROR';
    let shouldShowRetryDialog = false;
    
    // 更详细的错误分类
    const errorMsg = error.message || error.errMsg || '';
    
    if (errorMsg.includes('TIMEOUT') || errorMsg.includes('超时')) {
      errorMessage = '网络超时，请检查网络连接后重试';
      errorCode = 'TIMEOUT_ERROR';
      shouldShowRetryDialog = true;
    } else if (errorMsg.includes('NETWORK') || errorMsg.includes('网络') || errorMsg.includes('连接失败')) {
      errorMessage = '网络连接失败，请检查网络设置';
      errorCode = 'NETWORK_ERROR';
      shouldShowRetryDialog = true;
    } else if (errorMsg.includes('INVALID_FOOD_NAME') || errorMsg.includes('食物名称无效')) {
      errorMessage = '食物名称无效，请重新输入';
      errorCode = 'INVALID_FOOD_NAME';
    } else if (errorMsg.includes('RECIPE_GENERATION_FAILED') || errorMsg.includes('菜谱生成失败')) {
      errorMessage = 'AI服务暂时不可用，请稍后重试';
      errorCode = 'SERVICE_ERROR';
      shouldShowRetryDialog = canRetry;
    } else if (errorMsg.includes('服务器') || errorMsg.includes('500') || errorMsg.includes('502')) {
      errorMessage = '服务器繁忙，请稍后重试';
      errorCode = 'SERVER_ERROR';
      shouldShowRetryDialog = canRetry;
    }
    
    // 任务4.2: 实现错误处理和本地状态管理 - 更新错误状态
    this.setData({
      loading: false,
      loadingStage: 'error',
      error: errorMessage,
      retryCount: retryCount,
      recipe: null, // 清除可能的部分数据
      lastError: {
        message: errorMessage,
        code: errorCode,
        timestamp: Date.now(),
        canRetry: canRetry,
        originalError: errorMsg
      },
      // 任务4.2: 增强的错误状态管理
      errorOccurredAt: Date.now(),
      errorContext: {
        foodName: foodName,
        source: source,
        attemptNumber: retryCount,
        sessionId: this.data.pageInitializedAt
      },
      // 任务4.2: 完整的数据加载状态更新（错误情况）
      dataLoadingState: {
        ...this.data.dataLoadingState,
        responseReceived: true,
        hasError: true,
        errorTimestamp: Date.now(),
        loadingFailed: true
      },
      // 错误恢复状态
      errorRecovery: {
        canRetry: canRetry,
        retryAttempts: retryCount,
        maxRetries: this.data.maxRetries,
        suggestedActions: this.getSuggestedErrorActions(errorCode, canRetry),
        autoRetryEnabled: retryCount < 2 && (errorCode === 'NETWORK_ERROR' || errorCode === 'TIMEOUT_ERROR')
      }
    });
    
    // 记录错误到本地存储
    this.recordRecipeError(error, foodName, source);
    
    // 需求6.2: 显示错误提示信息 - 使用统一的错误提示界面
    // 需求6.3: 提供重试功能当操作失败时
    try {
      if (errorCode === 'NETWORK_ERROR' || errorCode === 'TIMEOUT_ERROR') {
        // 网络错误使用专用对话框 - 需求6.3: 实现网络错误的重试功能
        const action = await showNetworkErrorDialog(error, {
          maxRetries: this.data.maxRetries,
          currentRetry: retryCount,
          autoRetry: retryCount < 2 // 前两次自动重试
        });
        
        if (action === 'retry' && canRetry) {
          // 显示重试反馈 - 需求6.5: 操作成功的确认反馈
          showSuccessFeedback('正在重新生成菜谱...', {
            type: 'info',
            duration: 1500
          });
          setTimeout(() => this.retryGenerate(), 1500);
        } else {
          this.showErrorOptions();
        }
      } else {
        // 其他错误使用统一错误界面 - 需求6.2: 创建统一的错误提示界面
        const action = await showUnifiedErrorDialog(error, {
          title: '菜谱生成失败',
          showRetry: canRetry,
          showCancel: true,
          retryText: '重新生成',
          cancelText: '返回首页',
          context: 'recipe-generation'
        });
        
        if (action === 'retry' && canRetry) {
          // 需求6.3: 重试功能
          showSuccessFeedback('正在重新生成菜谱...', {
            type: 'info',
            duration: 1500
          });
          setTimeout(() => this.retryGenerate(), 1500);
        } else {
          this.goHome();
        }
      }
    } catch (dialogError) {
      console.error('显示错误对话框失败:', dialogError);
      // 如果对话框显示失败，直接显示错误选项
      this.showErrorOptions();
    }
    
    console.error('错误状态已更新到本地状态管理:', { errorCode, errorMessage, retryCount });
  },

  /**
   * 显示错误处理选项
   */
  showErrorOptions() {
    wx.showActionSheet({
      itemList: ['重新搜索', '返回首页', '重试生成'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.searchAgain();
            break;
          case 1:
            this.goHome();
            break;
          case 2:
            if (this.data.retryCount < this.data.maxRetries) {
              this.retryGenerate();
            } else {
              showError('已达到最大重试次数', 2000);
            }
            break;
        }
      }
    });
  },

  /**
   * 处理页面错误
   * @param {String} message 错误信息
   * @param {String} code 错误代码
   */
  handlePageError(message, code) {
    this.setData({
      loading: false,
      loadingStage: 'error',
      error: message,
      pageReady: false
    });
    
    showError(message, 3000);
    console.error('页面错误:', { message, code });
  },

  /**
   * 显示重试选项
   */
  showRetryOption() {
    if (this.data.error && this.data.retryCount < this.data.maxRetries) {
      wx.showModal({
        title: '生成失败',
        content: '菜谱生成失败，是否重新尝试？',
        confirmText: '重试',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            this.retryGenerate();
          } else {
            this.goHome();
          }
        }
      });
    }
  },

  /**
   * 生成增强的模拟菜谱数据 - 包含营养信息和专业内容
   * @param {String} foodName 食物名称
   * @param {String} source 来源
   * @returns {Object} 菜谱数据
   */
  generateMockRecipe(foodName, source) {
    // 中餐菜系特色数据库
    const cuisineFeatures = {
      '川菜': { spiceLevel: '麻辣', characteristics: '麻辣鲜香，口味浓重', region: '四川' },
      '粤菜': { spiceLevel: '清淡', characteristics: '清淡鲜美，注重原味', region: '广东' },
      '鲁菜': { spiceLevel: '适中', characteristics: '咸鲜为主，突出本味', region: '山东' },
      '苏菜': { spiceLevel: '清淡', characteristics: '清淡微甜，制作精细', region: '江苏' },
      '浙菜': { spiceLevel: '清淡', characteristics: '清鲜脆嫩，保持本色', region: '浙江' },
      '闽菜': { spiceLevel: '清淡', characteristics: '清鲜淡雅，汤菜居多', region: '福建' },
      '湘菜': { spiceLevel: '香辣', characteristics: '香辣酸甜，口味浓郁', region: '湖南' },
      '徽菜': { spiceLevel: '适中', characteristics: '重油重色，朴实厚重', region: '安徽' }
    };

    // 专业菜谱数据库
    const professionalRecipes = {
      '红烧肉': {
        name: '红烧肉',
        cuisine: '川菜',
        cookingTime: '60分钟',
        difficulty: '中等',
        servings: '2-3人份',
        description: '红烧肉是川菜中的经典名菜，以五花肉为主料，采用传统红烧工艺制作。成菜色泽红亮，肥而不腻，入口即化，是家常菜中的佼佼者。',
        ingredients: [
          { name: '五花肉', amount: '500克', note: '选择肥瘦相间，肉质新鲜的' },
          { name: '生姜', amount: '15克', note: '切片，去腥增香' },
          { name: '大葱', amount: '2根', note: '切段，白绿分开' },
          { name: '料酒', amount: '30毫升', note: '黄酒或料酒均可' },
          { name: '老抽', amount: '15毫升', note: '用于上色，不宜过多' },
          { name: '生抽', amount: '30毫升', note: '调味用' },
          { name: '冰糖', amount: '30克', note: '增加光泽和甜味' },
          { name: '八角', amount: '2个', note: '增加香味' },
          { name: '桂皮', amount: '1小段', note: '增加层次香味' },
          { name: '香叶', amount: '2片', note: '提香用' }
        ],
        steps: [
          { stepNumber: 1, description: '五花肉洗净切成2厘米见方的块状，冷水下锅焯水去血沫', tip: '焯水时加入料酒和姜片去腥，水开后煮3分钟即可' },
          { stepNumber: 2, description: '热锅下少许油，放入焯好的五花肉小火慢煎', tip: '煎至表面微黄出油，这样可以去除部分油腻感' },
          { stepNumber: 3, description: '推肉至一边，下冰糖小火炒制糖色', tip: '糖色要炒至焦糖色，不能炒糊，这是红烧肉色泽的关键' },
          { stepNumber: 4, description: '糖色炒好后与肉块翻炒均匀，加入料酒炝锅', tip: '料酒沿锅边淋入，利用高温挥发酒精去腥' },
          { stepNumber: 5, description: '依次加入老抽、生抽翻炒上色', tip: '老抽主要用于上色，生抽用于调味，比例要掌握好' },
          { stepNumber: 6, description: '加入姜片、葱段、八角、桂皮、香叶翻炒出香', tip: '香料不要炒糊，出香即可' },
          { stepNumber: 7, description: '加入开水没过肉块，大火烧开转小火炖煮45分钟', tip: '一定要用开水，冷水会使肉质收缩变硬' },
          { stepNumber: 8, description: '最后大火收汁，汁浓肉烂即可出锅', tip: '收汁时要不断翻动，避免粘锅，汁要收得浓稠有光泽' }
        ],
        tips: [
          '选择肥瘦相间的五花肉，肥肉约占1/3为佳，这样做出来的红烧肉肥而不腻',
          '糖色是红烧肉成功的关键，要用小火慢炒，炒至焦糖色泽最佳',
          '炖煮时间要充足，至少45分钟，这样肉质才能软烂入味',
          '收汁时火候要大，但要勤翻动，让每块肉都裹上浓稠的汁水',
          '可根据个人口味适量调整糖和酱油的用量'
        ],
        nutrition: {
          calories: '320kcal/100g',
          protein: '15.2g/100g',
          fat: '28.5g/100g',
          carbs: '4.8g/100g',
          fiber: '0.2g/100g',
          sodium: '680mg/100g',
          cholesterol: '85mg/100g'
        },
        healthBenefits: [
          '富含优质蛋白质，有助于肌肉生长和修复',
          '含有丰富的维生素B族，促进新陈代谢',
          '适量食用可补充人体所需的脂肪酸',
          '含铁量较高，有助于预防缺铁性贫血'
        ],
        dietaryAdvice: [
          '高血脂患者应适量食用，建议去除部分肥肉',
          '糖尿病患者注意控制食用量，因含糖较多',
          '减肥期间可偶尔食用，但要控制分量',
          '老人和儿童食用时可适当延长炖煮时间，使肉质更软烂'
        ]
      },
      '宫保鸡丁': {
        name: '宫保鸡丁',
        cuisine: '川菜',
        cookingTime: '25分钟',
        difficulty: '中等',
        servings: '2-3人份',
        description: '宫保鸡丁是川菜中的传统名菜，以鸡胸肉为主料，配以花生米、干辣椒等，口感鲜嫩，麻辣适中，是川菜的代表菜品之一。',
        ingredients: [
          { name: '鸡胸肉', amount: '300克', note: '切丁，用料酒和淀粉腌制' },
          { name: '花生米', amount: '80克', note: '油炸至酥脆' },
          { name: '干辣椒', amount: '8-10个', note: '去籽切段' },
          { name: '花椒', amount: '1茶匙', note: '四川花椒最佳' },
          { name: '大葱', amount: '1根', note: '切段' },
          { name: '生姜', amount: '10克', note: '切末' },
          { name: '大蒜', amount: '3瓣', note: '切末' }
        ],
        steps: [
          { stepNumber: 1, description: '鸡胸肉切丁，用料酒、盐、淀粉腌制15分钟', tip: '腌制可使鸡肉更嫩滑' },
          { stepNumber: 2, description: '热油炸花生米至酥脆，捞出备用', tip: '油温不宜过高，小火慢炸' },
          { stepNumber: 3, description: '鸡丁下锅滑炒至变色盛起', tip: '火候要大，快速滑炒保持嫩度' },
          { stepNumber: 4, description: '爆炒干辣椒和花椒出香味', tip: '不要炒糊，出香即可' },
          { stepNumber: 5, description: '下鸡丁翻炒，调味勾芡', tip: '动作要快，保持鸡肉嫩滑' },
          { stepNumber: 6, description: '最后加入花生米翻匀即可', tip: '花生米最后加入保持酥脆' }
        ],
        tips: [
          '鸡肉要选用鸡胸肉，切丁要均匀',
          '花椒要用四川花椒，香味更正宗',
          '炒制过程要大火快炒，保持食材的鲜嫩',
          '调料的比例要掌握好，突出麻辣鲜香的特色'
        ],
        nutrition: {
          calories: '245kcal/100g',
          protein: '22.8g/100g',
          fat: '14.2g/100g',
          carbs: '8.5g/100g',
          fiber: '1.8g/100g',
          sodium: '520mg/100g',
          cholesterol: '65mg/100g'
        },
        healthBenefits: [
          '鸡肉富含优质蛋白质，易于消化吸收',
          '花生含有丰富的不饱和脂肪酸，有益心血管健康',
          '辣椒含有维生素C，有助于提高免疫力',
          '适量的辣味可促进食欲和消化'
        ],
        dietaryAdvice: [
          '辣椒敏感者可减少干辣椒用量',
          '高血压患者注意控制盐分摄入',
          '花生过敏者请避免食用',
          '减肥期间可适量食用，注意控制油量'
        ]
      }
    };

    // 如果有专业菜谱，返回专业版本
    if (professionalRecipes[foodName]) {
      const recipe = professionalRecipes[foodName];
      const cuisineInfo = cuisineFeatures[recipe.cuisine] || {};
      
      return {
        ...recipe,
        id: Date.now().toString(),
        cuisineFeatures: cuisineInfo,
        createdAt: new Date().toISOString(),
        source: source
      };
    }
    
    // 生成智能菜谱模板
    return this.generateSmartRecipeTemplate(foodName, source);
  },

  /**
   * 生成智能菜谱模板
   * @param {String} foodName 食物名称
   * @param {String} source 来源
   * @returns {Object} 智能生成的菜谱
   */
  generateSmartRecipeTemplate(foodName, source) {
    // 根据食物名称推断菜系和特征
    const cuisineMapping = {
      '麻婆豆腐': '川菜', '回锅肉': '川菜', '水煮鱼': '川菜', '辣子鸡': '川菜',
      '白切鸡': '粤菜', '糖醋里脊': '粤菜', '蒸蛋羹': '粤菜', '叉烧': '粤菜',
      '糖醋鲤鱼': '鲁菜', '九转大肠': '鲁菜', '德州扒鸡': '鲁菜',
      '松鼠桂鱼': '苏菜', '蟹粉狮子头': '苏菜', '盐水鸭': '苏菜',
      '西湖醋鱼': '浙菜', '东坡肉': '浙菜', '龙井虾仁': '浙菜',
      '佛跳墙': '闽菜', '荔枝肉': '闽菜', '沙茶面': '闽菜',
      '剁椒鱼头': '湘菜', '口味虾': '湘菜', '毛氏红烧肉': '湘菜',
      '臭鳜鱼': '徽菜', '毛豆腐': '徽菜', '刀板香': '徽菜'
    };

    const inferredCuisine = cuisineMapping[foodName] || '家常菜';
    const cuisineInfo = cuisineFeatures[inferredCuisine] || { 
      spiceLevel: '适中', 
      characteristics: '营养均衡，制作简单', 
      region: '全国' 
    };

    // 根据食物类型推断营养信息
    const nutritionEstimate = this.estimateNutrition(foodName);
    
    return {
      id: Date.now().toString(),
      name: foodName,
      cuisine: inferredCuisine,
      cookingTime: '30-45分钟',
      difficulty: '简单',
      servings: '2-3人份',
      description: `${foodName}是${inferredCuisine}中的特色菜品，${cuisineInfo.characteristics}，适合家庭制作。`,
      
      ingredients: [
        { name: '主料', amount: '适量', note: `新鲜的${foodName}主要食材` },
        { name: '调料', amount: '适量', note: '根据个人口味调整' },
        { name: '配菜', amount: '适量', note: '增加营养和口感层次' }
      ],
      
      steps: [
        { stepNumber: 1, description: `准备${foodName}的主要食材，清洗干净`, tip: '食材新鲜是美味的基础' },
        { stepNumber: 2, description: '根据传统做法进行初步处理', tip: '处理方法要得当，保持食材营养' },
        { stepNumber: 3, description: `按照${inferredCuisine}的特色烹饪方法制作`, tip: `${cuisineInfo.characteristics}` },
        { stepNumber: 4, description: '调味装盘，注意色香味俱全', tip: '最后的调味和摆盘同样重要' }
      ],
      
      tips: [
        `选择新鲜优质的食材是制作${foodName}的关键`,
        `掌握${inferredCuisine}的烹饪特点，${cuisineInfo.characteristics}`,
        '火候控制要适当，避免过度烹饪破坏营养',
        '可根据个人口味和饮食习惯适当调整调料用量'
      ],
      
      nutrition: nutritionEstimate,
      
      healthBenefits: [
        '提供人体必需的营养成分',
        '有助于维持营养均衡',
        '适量食用有益身体健康',
        '符合中式饮食的营养搭配原则'
      ],
      
      dietaryAdvice: [
        '建议搭配蔬菜一起食用，营养更均衡',
        '注意控制油盐用量，保持健康饮食',
        '特殊体质人群请根据自身情况适量食用',
        '建议新鲜制作，避免长时间存放'
      ],
      
      cuisineFeatures: cuisineInfo,
      createdAt: new Date().toISOString(),
      source: source
    };
  },

  /**
   * 估算营养信息
   * @param {String} foodName 食物名称
   * @returns {Object} 营养信息估算
   */
  estimateNutrition(foodName) {
    // 基于食物类型的营养估算
    const nutritionDatabase = {
      // 肉类
      '肉': { calories: 250, protein: 20, fat: 15, carbs: 5 },
      '鸡': { calories: 200, protein: 25, fat: 8, carbs: 2 },
      '鱼': { calories: 180, protein: 22, fat: 6, carbs: 1 },
      '虾': { calories: 120, protein: 24, fat: 2, carbs: 1 },
      
      // 蔬菜类
      '菜': { calories: 50, protein: 3, fat: 1, carbs: 8 },
      '豆腐': { calories: 150, protein: 12, fat: 8, carbs: 6 },
      '蛋': { calories: 160, protein: 13, fat: 11, carbs: 2 },
      
      // 主食类
      '面': { calories: 280, protein: 8, fat: 2, carbs: 55 },
      '饭': { calories: 250, protein: 6, fat: 1, carbs: 50 },
      '粥': { calories: 120, protein: 3, fat: 1, carbs: 25 }
    };

    // 根据食物名称匹配营养类型
    let matchedNutrition = { calories: 200, protein: 15, fat: 8, carbs: 15 }; // 默认值
    
    for (const [key, nutrition] of Object.entries(nutritionDatabase)) {
      if (foodName.includes(key)) {
        matchedNutrition = nutrition;
        break;
      }
    }

    return {
      calories: `${matchedNutrition.calories}kcal/100g`,
      protein: `${matchedNutrition.protein}g/100g`,
      fat: `${matchedNutrition.fat}g/100g`,
      carbs: `${matchedNutrition.carbs}g/100g`,
      fiber: '2-5g/100g',
      sodium: '300-600mg/100g',
      cholesterol: '30-80mg/100g'
    };
  },

  /**
   * 记录菜谱生成成功
   * @param {Object} recipeData 菜谱数据
   * @param {String} source 来源
   */
  recordRecipeSuccess(recipeData, source) {
    try {
      // 记录搜索历史
      const searchRecord = {
        id: recipeData.id || Date.now().toString(),
        foodName: recipeData.name,
        source: source,
        timestamp: Date.now(),
        success: true,
        cuisine: recipeData.cuisine,
        difficulty: recipeData.difficulty,
        cookingTime: recipeData.cookingTime
      };
      
      let searchHistory = wx.getStorageSync('recipeSearchHistory') || [];
      
      // 避免重复记录
      const existingIndex = searchHistory.findIndex(item => 
        item.foodName === searchRecord.foodName && 
        (Date.now() - item.timestamp) < 300000 // 5分钟内
      );
      
      if (existingIndex >= 0) {
        searchHistory[existingIndex] = searchRecord;
      } else {
        searchHistory.unshift(searchRecord);
      }
      
      // 限制历史记录数量
      if (searchHistory.length > 100) {
        searchHistory = searchHistory.slice(0, 100);
      }
      
      wx.setStorageSync('recipeSearchHistory', searchHistory);
      
      // 更新统计信息
      this.updateRecipeStats(recipeData, source);
      
    } catch (error) {
      console.warn('记录菜谱成功失败:', error);
    }
  },

  /**
   * 记录菜谱生成错误
   * @param {Error} error 错误对象
   * @param {String} foodName 食物名称
   * @param {String} source 来源
   */
  recordRecipeError(error, foodName, source) {
    try {
      const errorRecord = {
        foodName: foodName,
        source: source,
        timestamp: Date.now(),
        success: false,
        error: error.message,
        retryCount: this.data.retryCount
      };
      
      let errorHistory = wx.getStorageSync('recipeErrorHistory') || [];
      errorHistory.unshift(errorRecord);
      
      // 限制错误记录数量
      if (errorHistory.length > 50) {
        errorHistory = errorHistory.slice(0, 50);
      }
      
      wx.setStorageSync('recipeErrorHistory', errorHistory);
      
    } catch (storageError) {
      console.warn('记录错误历史失败:', storageError);
    }
  },

  /**
   * 更新菜谱统计信息
   * @param {Object} recipeData 菜谱数据
   * @param {String} source 来源
   */
  updateRecipeStats(recipeData, source) {
    try {
      let stats = wx.getStorageSync('recipeStats') || {
        totalGenerated: 0,
        bySource: {},
        byCuisine: {},
        byDifficulty: {},
        lastUpdated: Date.now()
      };
      
      // 更新总数
      stats.totalGenerated++;
      
      // 按来源统计
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;
      
      // 按菜系统计
      if (recipeData.cuisine) {
        stats.byCuisine[recipeData.cuisine] = (stats.byCuisine[recipeData.cuisine] || 0) + 1;
      }
      
      // 按难度统计
      if (recipeData.difficulty) {
        stats.byDifficulty[recipeData.difficulty] = (stats.byDifficulty[recipeData.difficulty] || 0) + 1;
      }
      
      stats.lastUpdated = Date.now();
      
      wx.setStorageSync('recipeStats', stats);
      
    } catch (error) {
      console.warn('更新统计信息失败:', error);
    }
  },

  // 返回首页
  goHome() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果无法返回，则跳转到首页
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }
    });
  },

  // 重新搜索
  searchAgain() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },

  /**
   * 重新生成菜谱
   */
  retryGenerate() {
    if (this.data.foodName) {
      // 强制重新生成，不使用缓存
      this.loadRecipe(this.data.foodName, 'retry');
    } else {
      showError('缺少食物名称，无法重新生成', 2000);
    }
  },

  /**
   * 获取当前页面状态 - 任务4.2: 管理菜谱数据的本地状态
   * @returns {Object} 页面状态信息
   */
  getPageState() {
    return {
      // 基本状态信息
      foodName: this.data.foodName,
      source: this.data.source,
      loading: this.data.loading,
      loadingStage: this.data.loadingStage,
      hasRecipe: !!this.data.recipe,
      hasError: !!this.data.error,
      retryCount: this.data.retryCount,
      pageReady: this.data.pageReady,
      
      // 任务4.2: 增强的状态信息
      pageInitializedAt: this.data.pageInitializedAt,
      loadingStartTime: this.data.loadingStartTime,
      loadingEndTime: this.data.loadingEndTime,
      totalLoadingTime: this.data.totalLoadingTime,
      fromCache: this.data.fromCache,
      lastUpdated: this.data.lastUpdated,
      currentRequest: this.data.currentRequest,
      
      // 状态历史
      stateHistoryCount: (this.data.stateHistory || []).length,
      loadingStateHistoryCount: (this.data.loadingStateHistory || []).length,
      
      // 性能指标
      parameterProcessingTime: this.data.parameterProcessingTime,
      
      // 错误信息
      lastError: this.data.lastError,
      errorContext: this.data.errorContext
    };
  },

  /**
   * 获取详细的本地状态信息 - 任务4.2: 管理菜谱数据的本地状态
   * @returns {Object} 详细状态信息
   */
  getDetailedLocalState() {
    try {
      const currentState = this.getPageState();
      
      // 获取持久化存储的相关数据
      const recipeHistory = wx.getStorageSync('recipeSearchHistory') || [];
      const errorHistory = wx.getStorageSync('recipeErrorHistory') || [];
      const requestHistory = wx.getStorageSync('recipeGenerationRequests') || [];
      const cacheStats = CacheManager.getStats();
      const performanceStats = PerformanceMonitor.getStats();

      return {
        // 当前页面状态
        currentState: currentState,
        
        // 本地存储状态
        localStorage: {
          recipeHistoryCount: recipeHistory.length,
          errorHistoryCount: errorHistory.length,
          requestHistoryCount: requestHistory.length,
          lastRecipeGenerated: recipeHistory[0]?.timestamp || null,
          lastError: errorHistory[0]?.timestamp || null
        },
        
        // 缓存状态
        cacheState: cacheStats,
        
        // 性能状态
        performanceState: performanceStats,
        
        // 内存中的状态历史
        memoryState: {
          stateHistory: this.data.stateHistory || [],
          loadingStateHistory: this.data.loadingStateHistory || []
        },
        
        // 生成时间戳
        generatedAt: Date.now()
      };
    } catch (error) {
      console.error('获取详细本地状态失败:', error);
      return {
        error: error.message,
        generatedAt: Date.now()
      };
    }
  },

  /**
   * 重置页面状态
   */
  resetPageState() {
    this.clearLoadingTimer();
    
    this.setData({
      recipe: null,
      loading: false,
      error: null,
      loadingStage: 'init',
      loadingProgress: 0,
      loadingMessage: '正在准备...',
      retryCount: 0,
      lastUpdated: null,
      lastError: null
    });
  },

  /**
   * 验证菜谱数据完整性 - 需求4.1: 确保显示完整的菜谱基本信息
   * @param {Object} recipeData 原始菜谱数据
   * @returns {Object} 验证后的菜谱数据
   */
  validateRecipeData(recipeData) {
    if (!recipeData || typeof recipeData !== 'object') {
      throw new Error('菜谱数据格式无效');
    }

    // 确保必需的基本信息存在 (需求4.1)
    const validatedRecipe = {
      id: recipeData.id || Date.now().toString(),
      name: recipeData.name || this.data.foodName || '未知菜品',
      cuisine: recipeData.cuisine || '家常菜',
      cookingTime: recipeData.cookingTime || '30分钟', // 需求4.1: 烹饪时间
      difficulty: recipeData.difficulty || '中等', // 需求4.1: 制作难度
      servings: recipeData.servings || '2-3人份',
      description: recipeData.description || '',
      
      // 确保食材清单存在 (需求4.2)
      ingredients: Array.isArray(recipeData.ingredients) ? recipeData.ingredients : [],
      
      // 确保制作步骤存在 (需求4.3)
      steps: Array.isArray(recipeData.steps) ? recipeData.steps : [],
      
      // 确保烹饪贴士存在 (需求4.4)
      tips: Array.isArray(recipeData.tips) ? recipeData.tips : [],
      
      // 营养信息
      nutrition: recipeData.nutrition || {},
      
      // 其他信息
      healthBenefits: recipeData.healthBenefits || [],
      dietaryAdvice: recipeData.dietaryAdvice || [],
      cuisineFeatures: recipeData.cuisineFeatures || {},
      
      // 元数据
      createdAt: recipeData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: this.data.source
    };

    // 验证关键数据
    if (validatedRecipe.ingredients.length === 0) {
      console.warn('菜谱缺少食材信息，使用默认数据');
      validatedRecipe.ingredients = [
        { name: '主要食材', amount: '适量', note: '请根据实际情况准备' }
      ];
    }

    if (validatedRecipe.steps.length === 0) {
      console.warn('菜谱缺少制作步骤，使用默认数据');
      validatedRecipe.steps = [
        { stepNumber: 1, description: '请参考传统做法制作', tip: '注意火候和时间控制' }
      ];
    }

    return validatedRecipe;
  },

  /**
   * 记录页面访问 - 本地状态管理
   * @param {String} foodName 食物名称
   * @param {String} source 来源
   */
  recordPageAccess(foodName, source) {
    try {
      const accessRecord = {
        foodName: foodName,
        source: source,
        timestamp: Date.now(),
        sessionId: Date.now().toString()
      };
      
      let accessHistory = wx.getStorageSync('pageAccessHistory') || [];
      accessHistory.unshift(accessRecord);
      
      // 限制历史记录数量
      if (accessHistory.length > 50) {
        accessHistory = accessHistory.slice(0, 50);
      }
      
      wx.setStorageSync('pageAccessHistory', accessHistory);
      console.log('页面访问已记录:', accessRecord);
      
    } catch (error) {
      console.warn('记录页面访问失败:', error);
    }
  },

  /**
   * 记录缓存使用情况
   * @param {String} foodName 食物名称
   */
  recordCacheUsage(foodName) {
    try {
      const cacheRecord = {
        foodName: foodName,
        timestamp: Date.now(),
        type: 'cache_hit'
      };
      
      let cacheStats = wx.getStorageSync('cacheUsageStats') || {
        totalHits: 0,
        totalMisses: 0,
        recentUsage: []
      };
      
      cacheStats.totalHits++;
      cacheStats.recentUsage.unshift(cacheRecord);
      
      // 限制记录数量
      if (cacheStats.recentUsage.length > 20) {
        cacheStats.recentUsage = cacheStats.recentUsage.slice(0, 20);
      }
      
      wx.setStorageSync('cacheUsageStats', cacheStats);
      console.log('缓存使用已记录:', cacheRecord);
      
    } catch (error) {
      console.warn('记录缓存使用失败:', error);
    }
  },

  /**
   * 更新页面状态 - 统一的状态管理方法 (任务4.2: 管理菜谱数据的本地状态)
   * @param {Object} stateUpdate 状态更新对象
   */
  updatePageState(stateUpdate) {
    try {
      // 记录状态变更日志
      console.log('页面状态更新:', stateUpdate);
      
      // 任务4.2: 增强的状态管理 - 记录状态变更历史
      const stateChangeRecord = {
        timestamp: Date.now(),
        changes: Object.keys(stateUpdate),
        previousState: {
          loading: this.data.loading,
          error: this.data.error,
          loadingStage: this.data.loadingStage,
          hasRecipe: !!this.data.recipe
        }
      };

      // 更新页面数据
      this.setData({
        ...stateUpdate,
        // 任务4.2: 添加状态变更历史到本地状态
        stateHistory: [...(this.data.stateHistory || []), stateChangeRecord].slice(-20) // 保留最近20次变更
      });
      
      // 如果状态包含错误，记录错误
      if (stateUpdate.error) {
        this.recordStateChange('error', stateUpdate.error);
      }
      
      // 如果状态包含成功的菜谱，记录成功
      if (stateUpdate.recipe && !stateUpdate.loading) {
        this.recordStateChange('success', stateUpdate.recipe.name);
      }

      // 任务4.2: 记录加载状态变更
      if (stateUpdate.loadingStage) {
        this.recordLoadingStateChange(stateUpdate.loadingStage, stateUpdate.loadingMessage);
      }
      
    } catch (error) {
      console.error('更新页面状态失败:', error);
    }
  },

  /**
   * 记录加载状态变更 - 任务4.2: 实现加载状态显示
   * @param {String} stage 加载阶段
   * @param {String} message 加载消息
   */
  recordLoadingStateChange(stage, message) {
    try {
      const loadingRecord = {
        stage: stage,
        message: message,
        timestamp: Date.now(),
        sessionId: this.data.pageInitializedAt
      };

      // 更新本地状态中的加载历史
      const loadingHistory = [...(this.data.loadingStateHistory || []), loadingRecord].slice(-10);
      
      this.setData({
        loadingStateHistory: loadingHistory
      });

      console.log('加载状态变更已记录:', loadingRecord);
      
    } catch (error) {
      console.warn('记录加载状态变更失败:', error);
    }
  },

  /**
   * 记录状态变更
   * @param {String} type 状态类型
   * @param {String} data 状态数据
   */
  recordStateChange(type, data) {
    try {
      const stateRecord = {
        type: type,
        data: data,
        timestamp: Date.now(),
        foodName: this.data.foodName,
        source: this.data.source
      };
      
      let stateHistory = wx.getStorageSync('pageStateHistory') || [];
      stateHistory.unshift(stateRecord);
      
      // 限制历史记录数量
      if (stateHistory.length > 30) {
        stateHistory = stateHistory.slice(0, 30);
      }
      
      wx.setStorageSync('pageStateHistory', stateHistory);
      
    } catch (error) {
      console.warn('记录状态变更失败:', error);
    }
  },

  /**
   * 记录菜谱生成请求 - 任务4.2: 处理菜谱生成请求
   * @param {String} foodName 食物名称
   * @param {String} source 来源类型
   * @param {String} recipeId 菜谱ID
   */
  recordRecipeGenerationRequest(foodName, source, recipeId) {
    try {
      const requestRecord = {
        foodName: foodName,
        source: source,
        recipeId: recipeId,
        timestamp: Date.now(),
        sessionId: this.data.pageInitializedAt,
        userAgent: wx.getSystemInfoSync().platform,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // 记录到本地状态
      this.setData({
        currentRequest: requestRecord
      });

      // 记录到持久化存储
      let requestHistory = wx.getStorageSync('recipeGenerationRequests') || [];
      requestHistory.unshift(requestRecord);

      // 限制历史记录数量
      if (requestHistory.length > 50) {
        requestHistory = requestHistory.slice(0, 50);
      }

      wx.setStorageSync('recipeGenerationRequests', requestHistory);
      
      console.log('菜谱生成请求已记录:', requestRecord);
      
    } catch (error) {
      console.warn('记录菜谱生成请求失败:', error);
    }
  },

  /**
   * 任务4.2增强: 获取完整的数据加载状态
   * @returns {Object} 完整的数据加载状态信息
   */
  getDataLoadingState() {
    return {
      // 基本加载状态
      isLoading: this.data.loading,
      loadingStage: this.data.loadingStage,
      loadingProgress: this.data.loadingProgress,
      loadingMessage: this.data.loadingMessage,
      
      // 数据状态
      hasData: !!this.data.recipe,
      dataSource: this.data.source,
      fromCache: this.data.fromCache,
      lastUpdated: this.data.lastUpdated,
      
      // 错误状态
      hasError: !!this.data.error,
      errorMessage: this.data.error,
      retryCount: this.data.retryCount,
      canRetry: this.data.retryCount < this.data.maxRetries,
      
      // 请求状态
      currentRequest: this.data.currentRequest,
      requestInProgress: this.data.loading && !!this.data.currentRequest,
      
      // 性能指标
      loadingStartTime: this.data.loadingStartTime,
      loadingEndTime: this.data.loadingEndTime,
      totalLoadingTime: this.data.totalLoadingTime,
      
      // 状态历史
      stateHistoryCount: (this.data.stateHistory || []).length,
      loadingStateHistoryCount: (this.data.loadingStateHistory || []).length
    };
  },

  /**
   * 任务4.2增强: 验证数据完整性和状态一致性
   * @returns {Object} 验证结果
   */
  validateDataState() {
    const validation = {
      isValid: true,
      issues: [],
      warnings: []
    };

    try {
      // 检查基本状态一致性
      if (this.data.loading && this.data.recipe) {
        validation.warnings.push('加载状态与数据状态不一致：正在加载但已有数据');
      }

      if (this.data.error && this.data.recipe) {
        validation.warnings.push('错误状态与数据状态不一致：有错误但也有数据');
      }

      if (!this.data.loading && !this.data.recipe && !this.data.error) {
        validation.issues.push('状态异常：无加载、无数据、无错误');
        validation.isValid = false;
      }

      // 检查必需参数
      if (!this.data.foodName) {
        validation.issues.push('缺少必需参数：foodName');
        validation.isValid = false;
      }

      // 检查数据完整性
      if (this.data.recipe) {
        if (!this.data.recipe.name) {
          validation.warnings.push('菜谱数据缺少名称');
        }
        if (!this.data.recipe.ingredients || this.data.recipe.ingredients.length === 0) {
          validation.warnings.push('菜谱数据缺少食材信息');
        }
        if (!this.data.recipe.steps || this.data.recipe.steps.length === 0) {
          validation.warnings.push('菜谱数据缺少制作步骤');
        }
      }

      // 检查重试逻辑
      if (this.data.retryCount > this.data.maxRetries) {
        validation.issues.push('重试次数超过最大限制');
        validation.isValid = false;
      }

      // 检查时间戳
      if (this.data.loadingStartTime && this.data.loadingEndTime) {
        if (this.data.loadingEndTime < this.data.loadingStartTime) {
          validation.issues.push('时间戳异常：结束时间早于开始时间');
          validation.isValid = false;
        }
      }

    } catch (error) {
      validation.issues.push(`验证过程出错：${error.message}`);
      validation.isValid = false;
    }

    return validation;
  },

  /**
   * 任务4.2增强: 同步本地状态到持久化存储
   */
  syncStateToStorage() {
    try {
      const stateSnapshot = {
        foodName: this.data.foodName,
        source: this.data.source,
        lastUpdated: this.data.lastUpdated,
        fromCache: this.data.fromCache,
        sessionId: this.data.pageInitializedAt,
        timestamp: Date.now()
      };

      // 保存当前会话状态
      wx.setStorageSync('currentRecipeSession', stateSnapshot);

      // 更新会话历史
      let sessionHistory = wx.getStorageSync('recipeSessionHistory') || [];
      sessionHistory.unshift(stateSnapshot);
      
      if (sessionHistory.length > 20) {
        sessionHistory = sessionHistory.slice(0, 20);
      }
      
      wx.setStorageSync('recipeSessionHistory', sessionHistory);

      console.log('本地状态已同步到持久化存储');
      
    } catch (error) {
      console.warn('同步状态到存储失败:', error);
    }
  },

  /**
   * 任务4.2增强: 从持久化存储恢复状态
   */
  restoreStateFromStorage() {
    try {
      const savedSession = wx.getStorageSync('currentRecipeSession');
      
      if (savedSession && savedSession.sessionId === this.data.pageInitializedAt) {
        // 恢复相同会话的状态
        this.setData({
          lastUpdated: savedSession.lastUpdated,
          fromCache: savedSession.fromCache
        });
        
        console.log('已从存储恢复状态:', savedSession);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('从存储恢复状态失败:', error);
      return false;
    }
  },

  /**
   * 任务4.2增强: 计算数据完整性评分
   * @param {Object} recipeData 菜谱数据
   * @returns {Number} 完整性评分 (0-100)
   */
  calculateDataCompleteness(recipeData) {
    if (!recipeData) return 0;

    let score = 0;
    const maxScore = 100;

    // 基本信息 (30分)
    if (recipeData.name) score += 10;
    if (recipeData.cookingTime) score += 5;
    if (recipeData.difficulty) score += 5;
    if (recipeData.servings) score += 5;
    if (recipeData.cuisine) score += 5;

    // 食材信息 (25分)
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      score += 15;
      // 食材详细程度
      const detailedIngredients = recipeData.ingredients.filter(ing => ing.amount && ing.name);
      if (detailedIngredients.length === recipeData.ingredients.length) {
        score += 10;
      } else if (detailedIngredients.length > recipeData.ingredients.length / 2) {
        score += 5;
      }
    }

    // 制作步骤 (25分)
    if (recipeData.steps && recipeData.steps.length > 0) {
      score += 15;
      // 步骤详细程度
      const detailedSteps = recipeData.steps.filter(step => step.description && step.description.length > 10);
      if (detailedSteps.length === recipeData.steps.length) {
        score += 10;
      } else if (detailedSteps.length > recipeData.steps.length / 2) {
        score += 5;
      }
    }

    // 额外信息 (20分)
    if (recipeData.tips && recipeData.tips.length > 0) score += 5;
    if (recipeData.nutrition && Object.keys(recipeData.nutrition).length > 0) score += 5;
    if (recipeData.description) score += 3;
    if (recipeData.healthBenefits && recipeData.healthBenefits.length > 0) score += 3;
    if (recipeData.dietaryAdvice && recipeData.dietaryAdvice.length > 0) score += 2;
    if (recipeData.cuisineFeatures) score += 2;

    return Math.min(score, maxScore);
  },

  /**
   * 任务4.2增强: 获取建议的错误处理操作
   * @param {String} errorCode 错误代码
   * @param {Boolean} canRetry 是否可以重试
   * @returns {Array} 建议的操作列表
   */
  getSuggestedErrorActions(errorCode, canRetry) {
    const actions = [];

    switch (errorCode) {
      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
        actions.push('检查网络连接');
        if (canRetry) actions.push('自动重试');
        actions.push('切换网络环境');
        break;
        
      case 'INVALID_FOOD_NAME':
        actions.push('重新输入食物名称');
        actions.push('尝试使用更常见的菜名');
        actions.push('返回首页重新搜索');
        break;
        
      case 'SERVICE_ERROR':
      case 'SERVER_ERROR':
        actions.push('稍后重试');
        if (canRetry) actions.push('自动重试');
        actions.push('联系技术支持');
        break;
        
      default:
        if (canRetry) actions.push('重试生成');
        actions.push('重新搜索');
        actions.push('返回首页');
        break;
    }

    return actions;
  }
});