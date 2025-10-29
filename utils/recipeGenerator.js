/**
 * 菜谱生成专用工具模块
 * 处理菜谱生成、验证、缓存和管理
 */

const { generateRecipe } = require('./api');
const { handleError, ERROR_CODES } = require('./errorHandler');
const { RECIPE_CONFIG } = require('./config');

/**
 * 智能菜谱生成
 * 根据食物名称和用户偏好生成个性化菜谱
 * @param {String} foodName 食物名称
 * @param {Object} options 生成选项
 * @returns {Promise<Object>} 菜谱数据
 */
function smartGenerateRecipe(foodName, options = {}) {
  const {
    userPreferences = {},
    enableCache = true,
    forceRegenerate = false
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // 检查缓存
      if (enableCache && !forceRegenerate) {
        const cachedRecipe = getCachedRecipe(foodName);
        if (cachedRecipe) {
          console.log('使用缓存的菜谱:', foodName);
          resolve(cachedRecipe);
          return;
        }
      }

      // 应用用户偏好
      const generationOptions = applyUserPreferences(options, userPreferences);

      // 生成菜谱
      const recipeResult = await generateRecipe(foodName, generationOptions);
      
      // 缓存结果
      if (enableCache && recipeResult.data) {
        cacheRecipe(foodName, recipeResult.data);
      }

      // 保存到历史记录
      saveRecipeHistory(recipeResult.data);

      resolve(recipeResult);

    } catch (error) {
      reject(handleError(error, { 
        context: 'smartGenerateRecipe',
        showToast: false 
      }));
    }
  });
}

/**
 * 应用用户偏好设置
 * @param {Object} options 原始选项
 * @param {Object} userPreferences 用户偏好
 * @returns {Object} 应用偏好后的选项
 */
function applyUserPreferences(options, userPreferences) {
  const {
    preferredCuisine = '',
    preferredDifficulty = '',
    dietaryRestrictions = [],
    spiceLevel = 'medium'
  } = userPreferences;

  return {
    ...options,
    cuisine: options.cuisine || preferredCuisine,
    difficulty: options.difficulty || preferredDifficulty,
    dietaryRestrictions: dietaryRestrictions,
    spiceLevel: spiceLevel
  };
}

/**
 * 批量生成菜谱
 * @param {Array<String>} foodNames 食物名称数组
 * @param {Object} options 生成选项
 * @returns {Promise<Array>} 菜谱数组
 */
function batchGenerateRecipes(foodNames, options = {}) {
  const {
    maxConcurrent = 2, // 限制并发数避免API限制
    continueOnError = true
  } = options;

  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let completed = 0;
    let currentIndex = 0;

    function processNext() {
      if (currentIndex >= foodNames.length) {
        resolve({
          results: results,
          errors: errors,
          total: foodNames.length,
          success: results.length,
          failed: errors.length
        });
        return;
      }

      const foodName = foodNames[currentIndex];
      const index = currentIndex;
      currentIndex++;

      smartGenerateRecipe(foodName, options)
        .then((result) => {
          results[index] = result;
          completed++;
          processNext();
        })
        .catch((error) => {
          errors[index] = { foodName, error: error.message };
          completed++;
          
          if (continueOnError) {
            processNext();
          } else {
            reject(error);
          }
        });
    }

    // 启动并发处理
    for (let i = 0; i < Math.min(maxConcurrent, foodNames.length); i++) {
      processNext();
    }
  });
}

/**
 * 获取缓存的菜谱
 * @param {String} foodName 食物名称
 * @returns {Object|null} 缓存的菜谱或null
 */
function getCachedRecipe(foodName) {
  try {
    const cacheKey = `recipe_${foodName.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = wx.getStorageSync(cacheKey);
    
    if (cached && cached.expireTime > Date.now()) {
      return cached.data;
    }
    
    // 清除过期缓存
    if (cached) {
      wx.removeStorageSync(cacheKey);
    }
    
    return null;
  } catch (error) {
    console.error('获取菜谱缓存失败:', error);
    return null;
  }
}

/**
 * 缓存菜谱数据
 * @param {String} foodName 食物名称
 * @param {Object} recipeData 菜谱数据
 */
function cacheRecipe(foodName, recipeData) {
  try {
    const cacheKey = `recipe_${foodName.toLowerCase().replace(/\s+/g, '_')}`;
    const cacheData = {
      data: recipeData,
      expireTime: Date.now() + (24 * 60 * 60 * 1000), // 24小时过期
      cachedAt: Date.now()
    };
    
    wx.setStorageSync(cacheKey, cacheData);
  } catch (error) {
    console.error('缓存菜谱失败:', error);
  }
}

/**
 * 获取菜谱历史记录
 * @param {Number} limit 返回数量限制
 * @returns {Array} 历史记录
 */
function getRecipeHistory(limit = 20) {
  try {
    const history = wx.getStorageSync('recipe_history') || [];
    return history.slice(0, limit);
  } catch (error) {
    console.error('获取菜谱历史失败:', error);
    return [];
  }
}

/**
 * 保存菜谱到历史记录
 * @param {Object} recipeData 菜谱数据
 */
function saveRecipeHistory(recipeData) {
  try {
    const history = getRecipeHistory(100); // 最多保存100条
    const newRecord = {
      id: recipeData.id || Date.now().toString(),
      name: recipeData.name,
      cuisine: recipeData.cuisine,
      difficulty: recipeData.difficulty,
      cookingTime: recipeData.cookingTime,
      timestamp: Date.now()
    };
    
    // 避免重复记录
    const exists = history.find(item => 
      item.name === newRecord.name && 
      (Date.now() - item.timestamp) < 300000 // 5分钟内的重复记录
    );
    
    if (!exists) {
      history.unshift(newRecord);
      wx.setStorageSync('recipe_history', history.slice(0, 100));
    }
  } catch (error) {
    console.error('保存菜谱历史失败:', error);
  }
}

/**
 * 搜索历史菜谱
 * @param {String} keyword 搜索关键词
 * @param {Object} filters 过滤条件
 * @returns {Array} 搜索结果
 */
function searchRecipeHistory(keyword, filters = {}) {
  try {
    const history = getRecipeHistory(100);
    const { cuisine, difficulty } = filters;
    
    let results = history;
    
    // 关键词搜索
    if (keyword && keyword.trim()) {
      const searchTerm = keyword.trim().toLowerCase();
      results = results.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm) ||
        recipe.cuisine.toLowerCase().includes(searchTerm)
      );
    }
    
    // 菜系过滤
    if (cuisine) {
      results = results.filter(recipe => recipe.cuisine === cuisine);
    }
    
    // 难度过滤
    if (difficulty) {
      results = results.filter(recipe => recipe.difficulty === difficulty);
    }
    
    return results;
  } catch (error) {
    console.error('搜索菜谱历史失败:', error);
    return [];
  }
}

/**
 * 清除菜谱缓存和历史
 * @param {String} type 清除类型: 'cache', 'history', 'all'
 */
function clearRecipeData(type = 'all') {
  try {
    if (type === 'cache' || type === 'all') {
      // 清除所有菜谱缓存
      const info = wx.getStorageInfoSync();
      const recipeKeys = info.keys.filter(key => key.startsWith('recipe_'));
      recipeKeys.forEach(key => {
        wx.removeStorageSync(key);
      });
    }
    
    if (type === 'history' || type === 'all') {
      wx.removeStorageSync('recipe_history');
    }
    
    return true;
  } catch (error) {
    console.error('清除菜谱数据失败:', error);
    return false;
  }
}

/**
 * 获取菜谱统计信息
 * @returns {Object} 统计信息
 */
function getRecipeStats() {
  try {
    const history = getRecipeHistory(1000);
    const cuisineStats = {};
    const difficultyStats = {};
    
    history.forEach(recipe => {
      // 菜系统计
      cuisineStats[recipe.cuisine] = (cuisineStats[recipe.cuisine] || 0) + 1;
      
      // 难度统计
      difficultyStats[recipe.difficulty] = (difficultyStats[recipe.difficulty] || 0) + 1;
    });
    
    return {
      totalRecipes: history.length,
      cuisineStats: cuisineStats,
      difficultyStats: difficultyStats,
      recentActivity: history.slice(0, 10)
    };
  } catch (error) {
    console.error('获取菜谱统计失败:', error);
    return {
      totalRecipes: 0,
      cuisineStats: {},
      difficultyStats: {},
      recentActivity: []
    };
  }
}

module.exports = {
  smartGenerateRecipe,
  batchGenerateRecipes,
  getCachedRecipe,
  cacheRecipe,
  getRecipeHistory,
  saveRecipeHistory,
  searchRecipeHistory,
  clearRecipeData,
  getRecipeStats,
  applyUserPreferences
};