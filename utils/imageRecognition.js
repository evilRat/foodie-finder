/**
 * 图像识别专用工具模块
 * 处理图片预处理、识别调用和结果处理
 */

const { recognizeFood, recognizeFoodWithRecipe } = require('./api');
const { handleError, ERROR_CODES } = require('./errorHandler');
const { IMAGE_CONFIG } = require('./config');

/**
 * 图片预处理和验证
 * @param {String} imagePath 图片路径
 * @returns {Promise<Object>} 预处理结果
 */
function preprocessImage(imagePath) {
  return new Promise((resolve, reject) => {
    // 获取图片信息
    wx.getFileInfo({
      filePath: imagePath,
      success: (fileInfo) => {
        // 验证文件大小
        if (fileInfo.size > IMAGE_CONFIG.maxFileSize) {
          reject(new Error('IMAGE_TOO_LARGE'));
          return;
        }

        // 验证文件格式
        const fileExtension = imagePath.split('.').pop().toLowerCase();
        if (!IMAGE_CONFIG.supportedFormats.includes(fileExtension)) {
          reject(new Error('IMAGE_FORMAT_ERROR'));
          return;
        }

        resolve({
          path: imagePath,
          size: fileInfo.size,
          format: fileExtension,
          isValid: true
        });
      },
      fail: (error) => {
        reject(new Error('图片信息获取失败: ' + error.errMsg));
      }
    });
  });
}

/**
 * 压缩图片
 * @param {String} imagePath 原始图片路径
 * @returns {Promise<String>} 压缩后的图片路径
 */
function compressImage(imagePath) {
  return new Promise((resolve, reject) => {
    const { quality, maxWidth, maxHeight } = IMAGE_CONFIG.compression;
    
    wx.compressImage({
      src: imagePath,
      quality: quality,
      compressedWidth: maxWidth,
      compressedHeight: maxHeight,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (error) => {
        // 如果压缩失败，返回原图片
        console.warn('图片压缩失败，使用原图片:', error);
        resolve(imagePath);
      }
    });
  });
}

/**
 * 智能图像识别
 * 包含预处理、压缩、识别的完整流程
 * @param {String} imagePath 图片路径
 * @param {Object} options 识别选项
 * @returns {Promise<Object>} 识别结果
 */
function smartRecognizeFood(imagePath, options = {}) {
  const {
    enableCompression = true,
    enablePreprocess = true,
    ...recognitionOptions
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      let processedImagePath = imagePath;

      // 预处理验证
      if (enablePreprocess) {
        const preprocessResult = await preprocessImage(imagePath);
        console.log('图片预处理完成:', preprocessResult);
      }

      // 图片压缩
      if (enableCompression) {
        processedImagePath = await compressImage(imagePath);
        console.log('图片压缩完成:', processedImagePath);
      }

      // 执行识别
      const recognitionResult = await recognizeFood(processedImagePath, recognitionOptions);
      
      resolve({
        ...recognitionResult,
        originalPath: imagePath,
        processedPath: processedImagePath,
        processingSteps: {
          preprocessed: enablePreprocess,
          compressed: enableCompression
        }
      });

    } catch (error) {
      reject(handleError(error, { 
        context: 'smartRecognizeFood',
        showToast: false 
      }));
    }
  });
}

/**
 * 批量图像识别
 * @param {Array<String>} imagePaths 图片路径数组
 * @param {Object} options 识别选项
 * @returns {Promise<Array>} 识别结果数组
 */
function batchRecognizeFood(imagePaths, options = {}) {
  const {
    maxConcurrent = 3, // 最大并发数
    continueOnError = true, // 是否在单个识别失败时继续
    ...recognitionOptions
  } = options;

  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let completed = 0;
    let currentIndex = 0;

    function processNext() {
      if (currentIndex >= imagePaths.length) {
        // 所有任务完成
        if (results.length === 0 && errors.length > 0) {
          reject(new Error('所有图片识别都失败了'));
        } else {
          resolve({
            results: results,
            errors: errors,
            total: imagePaths.length,
            success: results.length,
            failed: errors.length
          });
        }
        return;
      }

      const imagePath = imagePaths[currentIndex];
      const index = currentIndex;
      currentIndex++;

      smartRecognizeFood(imagePath, recognitionOptions)
        .then((result) => {
          results[index] = result;
          completed++;
          processNext();
        })
        .catch((error) => {
          errors[index] = { imagePath, error: error.message };
          completed++;
          
          if (continueOnError) {
            processNext();
          } else {
            reject(error);
          }
        });
    }

    // 启动并发处理
    for (let i = 0; i < Math.min(maxConcurrent, imagePaths.length); i++) {
      processNext();
    }
  });
}

/**
 * 获取识别历史记录
 * @param {Number} limit 返回数量限制
 * @returns {Array} 历史记录
 */
function getRecognitionHistory(limit = 10) {
  try {
    const history = wx.getStorageSync('recognition_history') || [];
    return history.slice(0, limit);
  } catch (error) {
    console.error('获取识别历史失败:', error);
    return [];
  }
}

/**
 * 保存识别记录到历史
 * @param {Object} recognitionResult 识别结果
 */
function saveRecognitionHistory(recognitionResult) {
  try {
    const history = getRecognitionHistory(50); // 最多保存50条
    const newRecord = {
      foodName: recognitionResult.foodName,
      confidence: recognitionResult.confidence,
      timestamp: Date.now(),
      id: Date.now().toString()
    };
    
    // 避免重复记录
    const exists = history.find(item => 
      item.foodName === newRecord.foodName && 
      (Date.now() - item.timestamp) < 60000 // 1分钟内的重复记录
    );
    
    if (!exists) {
      history.unshift(newRecord);
      wx.setStorageSync('recognition_history', history.slice(0, 50));
    }
  } catch (error) {
    console.error('保存识别历史失败:', error);
  }
}

/**
 * 清除识别历史
 */
function clearRecognitionHistory() {
  try {
    wx.removeStorageSync('recognition_history');
    return true;
  } catch (error) {
    console.error('清除识别历史失败:', error);
    return false;
  }
}

module.exports = {
  preprocessImage,
  compressImage,
  smartRecognizeFood,
  batchRecognizeFood,
  getRecognitionHistory,
  saveRecognitionHistory,
  clearRecognitionHistory
};