/**
 * 工具模块统一导出
 * 方便其他模块导入使用
 */

const api = require('./api');
const util = require('./util');
const errorHandler = require('./errorHandler');
const config = require('./config');
const storage = require('./storage');
const imageRecognition = require('./imageRecognition');
const recipeGenerator = require('./recipeGenerator');

/**
 * 验证用户输入
 * @param {string} input 用户输入的文字
 * @returns {object} 验证结果
 */
function validateInput(input) {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      message: '请输入食物名称'
    };
  }
  
  const trimmedInput = input.trim();
  
  if (trimmedInput.length === 0) {
    return {
      valid: false,
      message: '请输入食物名称'
    };
  }
  
  if (trimmedInput.length > 20) {
    return {
      valid: false,
      message: '食物名称不能超过20个字符'
    };
  }
  
  // 检查是否包含特殊字符
  const specialChars = /[<>{}[\]\\\/]/;
  if (specialChars.test(trimmedInput)) {
    return {
      valid: false,
      message: '食物名称不能包含特殊字符'
    };
  }
  
  return {
    valid: true,
    message: '验证通过'
  };
}

/**
 * 验证图片
 * @param {string} imagePath 图片路径
 * @returns {object} 验证结果
 */
function validateImage(imagePath) {
  if (!imagePath) {
    return {
      valid: false,
      message: '请选择图片'
    };
  }
  
  // 检查路径是否为字符串
  if (typeof imagePath !== 'string') {
    return {
      valid: false,
      message: '图片路径格式错误'
    };
  }
  
  // 检查路径长度
  if (imagePath.length === 0) {
    return {
      valid: false,
      message: '图片路径不能为空'
    };
  }
  
  // 检查是否为微信临时文件路径
  if (!imagePath.startsWith('wxfile://') && !imagePath.startsWith('http://tmp/') && !imagePath.includes('tmp_')) {
    // 对于非临时文件，检查文件扩展名
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lastDotIndex = imagePath.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      return {
        valid: false,
        message: '图片文件缺少扩展名'
      };
    }
    
    const extension = imagePath.toLowerCase().substring(lastDotIndex);
    
    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        message: '请选择JPG、PNG或WEBP格式的图片'
      };
    }
  }
  
  return {
    valid: true,
    message: '验证通过'
  };
}

/**
 * 验证图片大小
 * @param {number} fileSize 文件大小（字节）
 * @param {number} maxSize 最大大小（MB）
 * @returns {object} 验证结果
 */
function validateImageSize(fileSize, maxSize = 5) {
  if (!fileSize || typeof fileSize !== 'number') {
    return {
      valid: true,
      message: '无法获取文件大小，跳过验证'
    };
  }
  
  const maxSizeBytes = maxSize * 1024 * 1024; // 转换为字节
  
  if (fileSize > maxSizeBytes) {
    return {
      valid: false,
      message: `图片大小不能超过${maxSize}MB`
    };
  }
  
  return {
    valid: true,
    message: '验证通过'
  };
}

module.exports = {
  api,
  util,
  errorHandler,
  config,
  storage,
  imageRecognition,
  recipeGenerator,
  validateInput,
  validateImage,
  validateImageSize
};