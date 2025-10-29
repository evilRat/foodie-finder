/**
 * 统一错误处理模块
 * 定义错误类型、错误处理策略和用户友好的错误提示
 */

// 错误代码定义
const ERROR_CODES = {
  // 网络错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // 图像识别错误
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  IMAGE_FORMAT_ERROR: 'IMAGE_FORMAT_ERROR',
  RECOGNITION_FAILED: 'RECOGNITION_FAILED',
  NO_FOOD_DETECTED: 'NO_FOOD_DETECTED',
  
  // 菜谱生成错误
  RECIPE_GENERATION_FAILED: 'RECIPE_GENERATION_FAILED',
  INVALID_FOOD_NAME: 'INVALID_FOOD_NAME',
  
  // 系统错误
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  
  // 用户操作错误
  USER_CANCEL: 'USER_CANCEL',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};

// 错误信息映射
const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [ERROR_CODES.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ERROR_CODES.IMAGE_TOO_LARGE]: '图片大小超过5MB，请选择较小的图片',
  [ERROR_CODES.IMAGE_FORMAT_ERROR]: '不支持的图片格式，请选择JPG或PNG格式',
  [ERROR_CODES.RECOGNITION_FAILED]: '图片识别失败，请重新拍照或选择其他图片',
  [ERROR_CODES.NO_FOOD_DETECTED]: '未识别到食物，请确保图片中包含食物',
  [ERROR_CODES.RECIPE_GENERATION_FAILED]: '菜谱生成失败，请稍后重试',
  [ERROR_CODES.INVALID_FOOD_NAME]: '请输入有效的食物名称',
  [ERROR_CODES.SERVER_ERROR]: '服务器繁忙，请稍后重试',
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误，请稍后重试',
  [ERROR_CODES.USER_CANCEL]: '用户取消操作',
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足，请允许相关权限后重试'
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 错误分类函数
 * @param {Error} error 原始错误
 * @returns {String} 错误代码
 */
function classifyError(error) {
  const errorMessage = error.message || error.errMsg || '';
  
  // 直接匹配错误代码
  if (Object.values(ERROR_CODES).includes(errorMessage)) {
    return errorMessage;
  }
  
  // 网络相关错误
  if (errorMessage.includes('网络') || errorMessage.includes('network') || 
      errorMessage.includes('连接') || errorMessage.includes('connection')) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  
  // 超时错误
  if (errorMessage.includes('超时') || errorMessage.includes('timeout') ||
      errorMessage.includes('图像识别超时')) {
    return ERROR_CODES.TIMEOUT_ERROR;
  }
  
  // 图片相关错误
  if (errorMessage.includes('图片大小') || errorMessage.includes('5MB') ||
      errorMessage.includes('IMAGE_TOO_LARGE')) {
    return ERROR_CODES.IMAGE_TOO_LARGE;
  }
  
  if (errorMessage.includes('图片格式') || errorMessage.includes('JPG') || 
      errorMessage.includes('PNG') || errorMessage.includes('IMAGE_FORMAT_ERROR')) {
    return ERROR_CODES.IMAGE_FORMAT_ERROR;
  }
  
  if (errorMessage.includes('识别失败') || errorMessage.includes('recognition failed') ||
      errorMessage.includes('RECOGNITION_FAILED')) {
    return ERROR_CODES.RECOGNITION_FAILED;
  }
  
  if (errorMessage.includes('未识别到食物') || errorMessage.includes('no food detected') ||
      errorMessage.includes('NO_FOOD_DETECTED')) {
    return ERROR_CODES.NO_FOOD_DETECTED;
  }
  
  // 图片读取和处理错误
  if (errorMessage.includes('图片读取失败') || errorMessage.includes('图片信息获取失败')) {
    return ERROR_CODES.IMAGE_FORMAT_ERROR;
  }
  
  // 菜谱生成错误
  if (errorMessage.includes('菜谱生成') || errorMessage.includes('recipe generation')) {
    return ERROR_CODES.RECIPE_GENERATION_FAILED;
  }
  
  // 服务器错误
  if (errorMessage.includes('服务器') || errorMessage.includes('server') || 
      errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return ERROR_CODES.SERVER_ERROR;
  }
  
  // 用户取消
  if (errorMessage.includes('用户取消') || errorMessage.includes('cancel')) {
    return ERROR_CODES.USER_CANCEL;
  }
  
  // 权限错误
  if (errorMessage.includes('权限') || errorMessage.includes('permission')) {
    return ERROR_CODES.PERMISSION_DENIED;
  }
  
  return ERROR_CODES.UNKNOWN_ERROR;
}

/**
 * 统一错误处理函数
 * @param {Error} error 错误对象
 * @param {Object} options 处理选项
 * @returns {AppError} 处理后的错误对象
 */
function handleError(error, options = {}) {
  const {
    showToast = true,
    logError = true,
    context = 'unknown'
  } = options;
  
  let appError;
  
  if (error instanceof AppError) {
    appError = error;
  } else {
    const errorCode = classifyError(error);
    const errorMessage = ERROR_MESSAGES[errorCode] || error.message || '未知错误';
    appError = new AppError(errorCode, errorMessage, error);
  }
  
  // 记录错误日志
  if (logError) {
    console.error(`[${context}] Error:`, {
      code: appError.code,
      message: appError.message,
      timestamp: appError.timestamp,
      originalError: appError.originalError
    });
  }
  
  // 显示用户友好的错误提示
  if (showToast && appError.code !== ERROR_CODES.USER_CANCEL) {
    wx.showToast({
      title: appError.message,
      icon: 'error',
      duration: 3000
    });
  }
  
  return appError;
}

/**
 * 重试机制
 * @param {Function} asyncFunction 异步函数
 * @param {Number} maxRetries 最大重试次数
 * @param {Number} delay 重试延迟
 * @returns {Promise} 执行结果
 */
function retryAsync(asyncFunction, maxRetries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    let retryCount = 0;
    
    function attempt() {
      asyncFunction()
        .then(resolve)
        .catch((error) => {
          retryCount++;
          
          if (retryCount >= maxRetries) {
            reject(handleError(error, { context: 'retry-failed' }));
            return;
          }
          
          // 对于某些错误类型不进行重试
          const errorCode = classifyError(error);
          const noRetryErrors = [
            ERROR_CODES.IMAGE_TOO_LARGE,
            ERROR_CODES.IMAGE_FORMAT_ERROR,
            ERROR_CODES.INVALID_FOOD_NAME,
            ERROR_CODES.USER_CANCEL,
            ERROR_CODES.PERMISSION_DENIED
          ];
          
          if (noRetryErrors.includes(errorCode)) {
            reject(handleError(error, { context: 'no-retry-error' }));
            return;
          }
          
          console.log(`重试第 ${retryCount} 次，${delay}ms 后执行...`);
          setTimeout(attempt, delay);
        });
    }
    
    attempt();
  });
}

/**
 * 显示重试对话框
 * @param {String} message 错误信息
 * @param {Object} options 选项
 * @returns {Promise<Boolean>} 用户是否选择重试
 */
function showRetryDialog(message, options = {}) {
  const {
    title = '操作失败',
    confirmText = '重试',
    cancelText = '取消',
    showCancel = true
  } = options;
  
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: message + (showCancel ? '\n\n是否重试？' : ''),
      confirmText: confirmText,
      cancelText: cancelText,
      showCancel: showCancel,
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
 * 显示成功反馈 - 增强版 (需求6.5)
 * @param {String} message 成功信息
 * @param {Object} options 选项
 */
function showSuccessFeedback(message, options = {}) {
  const {
    duration = 2000,
    showModal = false,
    callback = null,
    showAnimation = true,
    type = 'success' // success, info, warning
  } = options;
  
  if (showModal) {
    wx.showModal({
      title: '操作成功',
      content: message,
      showCancel: false,
      confirmText: '确定',
      success: () => {
        if (callback) callback();
      }
    });
  } else {
    // 增强的成功反馈 - 需求6.5: 在操作完成后提供成功确认反馈
    const iconMap = {
      'success': 'success',
      'info': 'none',
      'warning': 'none'
    };
    
    wx.showToast({
      title: message,
      icon: iconMap[type] || 'success',
      duration: duration,
      mask: showAnimation,
      success: () => {
        if (callback) {
          setTimeout(callback, duration);
        }
      }
    });
    
    // 如果是重要的成功操作，添加震动反馈
    if (type === 'success' && showAnimation) {
      wx.vibrateShort({
        type: 'light'
      });
    }
  }
}

/**
 * 显示网络错误提示
 * @param {Error} error 错误对象
 * @returns {Promise<String>} 用户选择的操作
 */
function showNetworkErrorDialog(error) {
  return new Promise((resolve) => {
    const errorCode = classifyError(error);
    let content = ERROR_MESSAGES[errorCode] || error.message;
    
    if (errorCode === ERROR_CODES.NETWORK_ERROR) {
      content += '\n\n请检查网络连接后重试';
    } else if (errorCode === ERROR_CODES.TIMEOUT_ERROR) {
      content += '\n\n请稍后重试或检查网络状况';
    }
    
    wx.showModal({
      title: '网络异常',
      content: content,
      confirmText: '重试',
      cancelText: '取消',
      success: (res) => {
        resolve(res.confirm ? 'retry' : 'cancel');
      },
      fail: () => {
        resolve('cancel');
      }
    });
  });
}

/**
 * 显示操作确认反馈
 * @param {String} message 确认信息
 * @param {Function} onConfirm 确认回调
 * @param {Function} onCancel 取消回调
 */
function showConfirmFeedback(message, onConfirm, onCancel) {
  wx.showModal({
    title: '确认操作',
    content: message,
    confirmText: '确定',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm && onConfirm) {
        onConfirm();
      } else if (res.cancel && onCancel) {
        onCancel();
      }
    }
  });
}

/**
 * 显示统一的错误提示界面 - 需求6.2: 创建统一的错误提示界面
 * @param {Error|String} error 错误对象或错误信息
 * @param {Object} options 选项
 * @returns {Promise} 用户操作结果
 */
function showUnifiedErrorDialog(error, options = {}) {
  return new Promise((resolve) => {
    const {
      title = '操作失败',
      showRetry = true,
      showCancel = true,
      retryText = '重试',
      cancelText = '取消',
      context = 'unknown'
    } = options;
    
    // 处理错误信息
    let errorMessage = '';
    let errorCode = ERROR_CODES.UNKNOWN_ERROR;
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorCode = classifyError(error);
      errorMessage = ERROR_MESSAGES[errorCode] || error.message;
    }
    
    // 根据错误类型提供具体的解决建议
    const suggestions = getErrorSuggestions(errorCode);
    const fullMessage = suggestions ? `${errorMessage}\n\n建议：${suggestions}` : errorMessage;
    
    // 记录错误显示
    console.log(`显示统一错误对话框 [${context}]:`, { errorCode, errorMessage });
    
    const actions = [];
    if (showRetry) actions.push(retryText);
    if (showCancel) actions.push(cancelText);
    
    if (actions.length === 0) {
      // 只显示确认按钮
      wx.showModal({
        title: title,
        content: fullMessage,
        showCancel: false,
        confirmText: '确定',
        success: () => resolve('confirm')
      });
    } else if (actions.length === 1) {
      // 只有一个操作按钮
      wx.showModal({
        title: title,
        content: fullMessage,
        showCancel: false,
        confirmText: actions[0],
        success: () => resolve(showRetry ? 'retry' : 'cancel')
      });
    } else {
      // 有多个操作按钮
      wx.showModal({
        title: title,
        content: fullMessage,
        confirmText: retryText,
        cancelText: cancelText,
        success: (res) => {
          resolve(res.confirm ? 'retry' : 'cancel');
        },
        fail: () => resolve('cancel')
      });
    }
  });
}

/**
 * 获取错误建议
 * @param {String} errorCode 错误代码
 * @returns {String} 错误建议
 */
function getErrorSuggestions(errorCode) {
  const suggestions = {
    [ERROR_CODES.NETWORK_ERROR]: '请检查网络连接，确保网络畅通后重试',
    [ERROR_CODES.TIMEOUT_ERROR]: '请稍后重试，或检查网络速度是否正常',
    [ERROR_CODES.IMAGE_TOO_LARGE]: '请选择5MB以下的图片，或使用相机直接拍照',
    [ERROR_CODES.IMAGE_FORMAT_ERROR]: '请选择JPG、PNG或WEBP格式的图片',
    [ERROR_CODES.RECOGNITION_FAILED]: '请确保图片清晰且包含食物，或尝试重新拍照',
    [ERROR_CODES.NO_FOOD_DETECTED]: '请拍摄包含食物的清晰照片，避免背景过于复杂',
    [ERROR_CODES.RECIPE_GENERATION_FAILED]: '请稍后重试，或尝试使用文字搜索功能',
    [ERROR_CODES.INVALID_FOOD_NAME]: '请输入有效的食物名称，如"红烧肉"、"宫保鸡丁"等',
    [ERROR_CODES.SERVER_ERROR]: '服务器暂时繁忙，请稍后重试',
    [ERROR_CODES.PERMISSION_DENIED]: '请在设置中允许相关权限，然后重新尝试'
  };
  
  return suggestions[errorCode] || '请稍后重试，或联系客服获取帮助';
}

/**
 * 显示网络错误专用对话框 - 需求6.2, 6.3: 网络错误的重试功能
 * @param {Error} error 网络错误
 * @param {Object} options 选项
 * @returns {Promise} 用户操作结果
 */
function showNetworkErrorDialog(error, options = {}) {
  const {
    maxRetries = 3,
    currentRetry = 0,
    autoRetry = false
  } = options;
  
  return new Promise((resolve) => {
    const errorCode = classifyError(error);
    let title = '网络异常';
    let content = ERROR_MESSAGES[errorCode] || error.message;
    
    // 添加重试次数信息
    if (maxRetries > 1) {
      content += `\n\n重试次数：${currentRetry}/${maxRetries}`;
    }
    
    // 根据网络错误类型提供具体建议
    if (errorCode === ERROR_CODES.NETWORK_ERROR) {
      content += '\n\n请检查：\n• 网络连接是否正常\n• 是否开启了飞行模式\n• WiFi或移动数据是否可用';
    } else if (errorCode === ERROR_CODES.TIMEOUT_ERROR) {
      content += '\n\n请检查：\n• 网络速度是否过慢\n• 是否在网络信号较弱的地方\n• 可以尝试切换网络环境';
    }
    
    const canRetry = currentRetry < maxRetries;
    
    if (autoRetry && canRetry) {
      // 自动重试模式
      wx.showToast({
        title: `网络异常，${3 - currentRetry}秒后自动重试...`,
        icon: 'none',
        duration: 3000
      });
      
      setTimeout(() => {
        resolve('retry');
      }, 3000);
    } else {
      // 手动选择模式
      wx.showModal({
        title: title,
        content: content,
        confirmText: canRetry ? '重试' : '确定',
        cancelText: canRetry ? '取消' : '',
        showCancel: canRetry,
        success: (res) => {
          if (res.confirm && canRetry) {
            resolve('retry');
          } else {
            resolve('cancel');
          }
        },
        fail: () => resolve('cancel')
      });
    }
  });
}

/**
 * 全局错误监听器
 */
function setupGlobalErrorHandler() {
  // 监听小程序错误
  wx.onError((error) => {
    handleError(new Error(error), {
      context: 'global-error',
      showToast: false,
      logError: true
    });
  });
  
  // 监听未处理的Promise拒绝
  wx.onUnhandledRejection((res) => {
    handleError(res.reason, {
      context: 'unhandled-rejection',
      showToast: false,
      logError: true
    });
  });
}

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  AppError,
  classifyError,
  handleError,
  retryAsync,
  showRetryDialog,
  showSuccessFeedback,
  showNetworkErrorDialog,
  showConfirmFeedback,
  showUnifiedErrorDialog,
  getErrorSuggestions,
  setupGlobalErrorHandler
};