/**
 * API服务模块 - 封装所有API调用
 * 包含图像识别和菜谱生成的API接口
 */

const { getApiConfig } = require('./config');
const { handleError, retryAsync } = require('./errorHandler');

const CONFIG = {
  // API端点
  endpoints: {
    recognizeFood: '/api/recognize-food',
    generateRecipe: '/api/generate-recipe',
    uploadImage: '/api/upload-image'
  }
};

/**
 * 通用请求方法
 * @param {Object} options 请求配置
 * @returns {Promise} 请求结果
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const apiConfig = getApiConfig();
    
    const defaultOptions = {
      url: apiConfig.baseURL + options.url,
      method: options.method || 'GET',
      timeout: apiConfig.timeout,
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.data.message || '网络请求失败'}`));
        }
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '网络连接失败'));
      }
    };

    // 合并配置
    const requestOptions = { ...defaultOptions, ...options };
    
    // 发起请求
    wx.request(requestOptions);
  });
}

/**
 * 图像识别API - 增强版本
 * @param {String} imagePath 图片路径
 * @param {Object} options 可选参数
 * @returns {Promise} 识别结果
 */
function recognizeFood(imagePath, options = {}) {
  const {
    timeout = 5000, // 5秒超时限制 (需求2.3)
    enableRetry = true,
    maxRetries = 3
  } = options;

  return new Promise((resolve, reject) => {
    // 设置超时定时器
    const timeoutId = setTimeout(() => {
      reject(new Error('图像识别超时，请重试'));
    }, timeout);

    const recognitionProcess = retryAsync(() => {
      return new Promise((innerResolve, innerReject) => {
        // 验证图片文件
        wx.getFileInfo({
          filePath: imagePath,
          success: (fileInfo) => {
            // 检查文件大小 (需求3.2)
            if (fileInfo.size > 5 * 1024 * 1024) {
              innerReject(new Error('IMAGE_TOO_LARGE'));
              return;
            }

            // 将图片转换为base64
            wx.getFileSystemManager().readFile({
              filePath: imagePath,
              encoding: 'base64',
              success: (res) => {
                const imageData = res.data;
                const imageType = imagePath.split('.').pop().toLowerCase();
                
                // 验证图片格式
                if (!['jpg', 'jpeg', 'png'].includes(imageType)) {
                  innerReject(new Error('IMAGE_FORMAT_ERROR'));
                  return;
                }

                // 发送识别请求
                request({
                  url: CONFIG.endpoints.recognizeFood,
                  method: 'POST',
                  timeout: timeout - 1000, // 留出1秒缓冲时间
                  data: {
                    image: imageData,
                    imageType: imageType,
                    timestamp: Date.now()
                  }
                }).then((response) => {
                  // 解析识别结果 (需求2.2)
                  const result = parseRecognitionResult(response.data);
                  innerResolve(result);
                }).catch(innerReject);
              },
              fail: (error) => {
                innerReject(new Error('图片读取失败: ' + error.errMsg));
              }
            });
          },
          fail: (error) => {
            innerReject(new Error('图片信息获取失败: ' + error.errMsg));
          }
        });
      });
    }, enableRetry ? maxRetries : 1, 1000);

    recognitionProcess
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        // 统一错误处理 (需求2.5)
        const handledError = handleError(error, { 
          context: 'recognizeFood',
          showToast: false // 让调用方决定是否显示提示
        });
        reject(handledError);
      });
  });
}

/**
 * 解析图像识别结果
 * @param {Object} rawData 原始响应数据
 * @returns {Object} 格式化的识别结果
 */
function parseRecognitionResult(rawData) {
  try {
    const result = {
      success: true,
      foodName: rawData.foodName || '',
      confidence: rawData.confidence || 0,
      alternatives: rawData.alternatives || [],
      boundingBox: rawData.boundingBox || null,
      processingTime: rawData.processingTime || 0,
      timestamp: Date.now()
    };

    // 验证识别结果
    if (!result.foodName || result.confidence < 0.3) {
      throw new Error('NO_FOOD_DETECTED');
    }

    return result;
  } catch (error) {
    throw new Error('RECOGNITION_FAILED');
  }
}

/**
 * 带自动菜谱生成的图像识别 (需求3.4)
 * @param {String} imagePath 图片路径
 * @param {Object} options 可选参数
 * @returns {Promise} 包含识别结果和菜谱的完整数据
 */
function recognizeFoodWithRecipe(imagePath, options = {}) {
  const {
    autoGenerateRecipe = true,
    recipeOptions = {}
  } = options;

  return recognizeFood(imagePath, options)
    .then((recognitionResult) => {
      if (!autoGenerateRecipe) {
        return { recognition: recognitionResult };
      }

      // 自动生成菜谱
      return generateRecipe(recognitionResult.foodName, recipeOptions)
        .then((recipeResult) => {
          return {
            recognition: recognitionResult,
            recipe: recipeResult.data
          };
        })
        .catch((recipeError) => {
          // 即使菜谱生成失败，也返回识别结果
          console.warn('菜谱生成失败:', recipeError);
          return {
            recognition: recognitionResult,
            recipe: null,
            recipeError: recipeError.message
          };
        });
    });
}

/**
 * 菜谱生成API - 增强版本
 * @param {String} foodName 食物名称
 * @param {Object} options 可选参数
 * @returns {Promise} 菜谱数据
 */
function generateRecipe(foodName, options = {}) {
  const {
    cuisine = '', // 菜系
    difficulty = '', // 难度
    servings = '2-3人份', // 份量
    timeout = 30000, // 30秒超时 (需求5.5)
    enableRetry = true,
    maxRetries = 2
  } = options;

  // 验证输入参数
  if (!foodName || typeof foodName !== 'string' || foodName.trim().length === 0) {
    return Promise.reject(new Error('INVALID_FOOD_NAME'));
  }

  const requestData = {
    foodName: foodName.trim(),
    cuisine: cuisine,
    difficulty: difficulty,
    servings: servings,
    timestamp: Date.now(),
    // 专业中餐菜谱生成提示词 (需求5.1, 5.2)
    prompt: generateRecipePrompt(foodName.trim(), cuisine, difficulty)
  };

  return new Promise((resolve, reject) => {
    // 设置超时定时器
    const timeoutId = setTimeout(() => {
      reject(new Error('菜谱生成超时，请稍后重试'));
    }, timeout);

    const generationProcess = retryAsync(() => {
      return request({
        url: CONFIG.endpoints.generateRecipe,
        method: 'POST',
        timeout: timeout - 2000, // 留出2秒缓冲时间
        data: requestData
      });
    }, enableRetry ? maxRetries : 1, 2000);

    generationProcess
      .then((response) => {
        clearTimeout(timeoutId);
        // 处理生成结果的数据结构化和验证 (需求5.3)
        const validatedRecipe = validateAndStructureRecipe(response.data);
        resolve({
          ...response,
          data: validatedRecipe
        });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const handledError = handleError(error, { 
          context: 'generateRecipe',
          showToast: false 
        });
        reject(handledError);
      });
  });
}

/**
 * 生成专业中餐菜谱提示词 (需求5.1, 5.2)
 * @param {String} foodName 食物名称
 * @param {String} cuisine 菜系
 * @param {String} difficulty 难度
 * @returns {String} 提示词
 */
function generateRecipePrompt(foodName, cuisine = '', difficulty = '') {
  const basePrompt = `你是一位资深的中餐烹饪专家，拥有30年的烹饪经验，精通中国八大菜系。请根据用户提供的食物名称，生成一份详细、专业、易于家庭制作的菜谱。

要求：
1. 菜谱必须符合传统中餐制作工艺和${cuisine ? cuisine : '相应菜系'}特色
2. 食材用量适合2-3人份的家庭制作
3. 步骤描述要详细具体，包含火候、时间等关键信息
4. 提供实用的烹饪技巧和注意事项
5. 包含营养价值说明和食用建议
6. 难度等级应为${difficulty || '中等'}

输出格式要求（严格按照JSON格式）：
{
  "name": "菜品名称",
  "cuisine": "所属菜系（川菜/粤菜/鲁菜/苏菜/浙菜/闽菜/湘菜/徽菜）",
  "cookingTime": "烹饪时间（如：45分钟）",
  "difficulty": "难度等级（简单/中等/困难）",
  "servings": "份量（如：2-3人份）",
  "description": "菜品简介",
  "ingredients": [
    {
      "name": "食材名称",
      "amount": "用量",
      "note": "备注说明"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "description": "详细步骤描述",
      "tip": "烹饪小贴士"
    }
  ],
  "tips": [
    "烹饪贴士1",
    "烹饪贴士2"
  ],
  "nutrition": {
    "calories": "热量/100g",
    "protein": "蛋白质含量",
    "fat": "脂肪含量",
    "carbs": "碳水化合物含量"
  }
}

食物名称：${foodName}`;

  return basePrompt;
}

/**
 * 验证和结构化菜谱数据 (需求5.3)
 * @param {Object} rawRecipe 原始菜谱数据
 * @returns {Object} 验证后的菜谱数据
 */
function validateAndStructureRecipe(rawRecipe) {
  try {
    // 如果是字符串，尝试解析JSON
    let recipe = rawRecipe;
    if (typeof rawRecipe === 'string') {
      recipe = JSON.parse(rawRecipe);
    }

    // 验证必需字段
    const requiredFields = ['name', 'ingredients', 'steps'];
    for (const field of requiredFields) {
      if (!recipe[field]) {
        throw new Error(`缺少必需字段: ${field}`);
      }
    }

    // 标准化数据结构
    const structuredRecipe = {
      id: Date.now().toString(),
      name: recipe.name || '',
      cuisine: recipe.cuisine || '家常菜',
      cookingTime: recipe.cookingTime || '30分钟',
      difficulty: recipe.difficulty || '中等',
      servings: recipe.servings || '2-3人份',
      description: recipe.description || '',
      
      ingredients: (recipe.ingredients || []).map((ingredient, index) => ({
        id: index + 1,
        name: ingredient.name || '',
        amount: ingredient.amount || '',
        note: ingredient.note || ''
      })),
      
      steps: (recipe.steps || []).map((step, index) => ({
        stepNumber: step.stepNumber || index + 1,
        description: step.description || '',
        tip: step.tip || '',
        image: step.image || null
      })),
      
      tips: recipe.tips || [],
      
      nutrition: {
        calories: recipe.nutrition?.calories || '',
        protein: recipe.nutrition?.protein || '',
        fat: recipe.nutrition?.fat || '',
        carbs: recipe.nutrition?.carbs || ''
      },
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 验证数据完整性
    if (structuredRecipe.ingredients.length === 0) {
      throw new Error('菜谱必须包含食材信息');
    }

    if (structuredRecipe.steps.length === 0) {
      throw new Error('菜谱必须包含制作步骤');
    }

    return structuredRecipe;

  } catch (error) {
    console.error('菜谱数据验证失败:', error);
    throw new Error('RECIPE_GENERATION_FAILED');
  }
}

/**
 * 上传图片到服务器
 * @param {String} filePath 本地图片路径
 * @returns {Promise} 上传结果
 */
function uploadImage(filePath) {
  return retryAsync(() => {
    return new Promise((resolve, reject) => {
      const apiConfig = getApiConfig();
      
      wx.uploadFile({
        url: apiConfig.baseURL + CONFIG.endpoints.uploadImage,
        filePath: filePath,
        name: 'image',
        timeout: apiConfig.timeout,
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              resolve(data);
            } else {
              reject(new Error(data.message || '上传失败'));
            }
          } catch (error) {
            reject(new Error('响应数据解析失败'));
          }
        },
        fail: (error) => {
          reject(new Error('上传失败: ' + error.errMsg));
        }
      });
    });
  }, 3, 1000).catch(error => {
    throw handleError(error, { context: 'uploadImage' });
  });
}

module.exports = {
  request,
  recognizeFood,
  parseRecognitionResult,
  recognizeFoodWithRecipe,
  generateRecipe,
  generateRecipePrompt,
  validateAndStructureRecipe,
  uploadImage,
  CONFIG
};