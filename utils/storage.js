/**
 * 本地存储管理模块
 * 提供统一的数据存储和缓存管理功能
 */

const { CACHE_CONFIG } = require('./config');

/**
 * 设置本地存储数据
 * @param {String} key 存储键
 * @param {*} data 要存储的数据
 * @param {Number} expiration 过期时间(毫秒)，可选
 * @returns {Promise<Boolean>} 存储是否成功
 */
function setStorage(key, data, expiration = null) {
  return new Promise((resolve) => {
    try {
      const storageData = {
        data: data,
        timestamp: Date.now(),
        expiration: expiration
      };
      
      wx.setStorage({
        key: key,
        data: storageData,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    } catch (error) {
      console.error('存储数据失败:', error);
      resolve(false);
    }
  });
}

/**
 * 获取本地存储数据
 * @param {String} key 存储键
 * @returns {Promise<*>} 存储的数据，如果不存在或过期返回null
 */
function getStorage(key) {
  return new Promise((resolve) => {
    wx.getStorage({
      key: key,
      success: (res) => {
        try {
          const storageData = res.data;
          
          // 检查数据是否过期
          if (storageData.expiration && 
              Date.now() - storageData.timestamp > storageData.expiration) {
            // 数据已过期，删除并返回null
            removeStorage(key);
            resolve(null);
            return;
          }
          
          resolve(storageData.data);
        } catch (error) {
          console.error('解析存储数据失败:', error);
          resolve(null);
        }
      },
      fail: () => resolve(null)
    });
  });
}

/**
 * 删除本地存储数据
 * @param {String} key 存储键
 * @returns {Promise<Boolean>} 删除是否成功
 */
function removeStorage(key) {
  return new Promise((resolve) => {
    wx.removeStorage({
      key: key,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

/**
 * 清空所有本地存储
 * @returns {Promise<Boolean>} 清空是否成功
 */
function clearStorage() {
  return new Promise((resolve) => {
    wx.clearStorage({
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

/**
 * 获取存储信息
 * @returns {Promise<Object>} 存储信息
 */
function getStorageInfo() {
  return new Promise((resolve) => {
    wx.getStorageInfo({
      success: (res) => resolve(res),
      fail: () => resolve(null)
    });
  });
}

/**
 * 保存搜索历史
 * @param {String} searchText 搜索文本
 * @returns {Promise<Boolean>} 保存是否成功
 */
async function saveSearchHistory(searchText) {
  if (!searchText || searchText.trim() === '') {
    return false;
  }
  
  try {
    const history = await getSearchHistory();
    
    // 移除重复项
    const filteredHistory = history.filter(item => item !== searchText.trim());
    
    // 添加到开头
    filteredHistory.unshift(searchText.trim());
    
    // 限制数量
    const maxItems = CACHE_CONFIG.maxItems.searchHistory;
    if (filteredHistory.length > maxItems) {
      filteredHistory.splice(maxItems);
    }
    
    return await setStorage(
      CACHE_CONFIG.keys.searchHistory,
      filteredHistory,
      CACHE_CONFIG.expiration.searchHistory
    );
  } catch (error) {
    console.error('保存搜索历史失败:', error);
    return false;
  }
}

/**
 * 获取搜索历史
 * @returns {Promise<Array>} 搜索历史列表
 */
async function getSearchHistory() {
  try {
    const history = await getStorage(CACHE_CONFIG.keys.searchHistory);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('获取搜索历史失败:', error);
    return [];
  }
}

/**
 * 清空搜索历史
 * @returns {Promise<Boolean>} 清空是否成功
 */
function clearSearchHistory() {
  return removeStorage(CACHE_CONFIG.keys.searchHistory);
}

/**
 * 保存最近的菜谱
 * @param {Object} recipe 菜谱数据
 * @returns {Promise<Boolean>} 保存是否成功
 */
async function saveRecentRecipe(recipe) {
  if (!recipe || !recipe.name) {
    return false;
  }
  
  try {
    const recentRecipes = await getRecentRecipes();
    
    // 添加时间戳
    const recipeWithTimestamp = {
      ...recipe,
      viewedAt: Date.now()
    };
    
    // 移除重复项（基于菜谱名称）
    const filteredRecipes = recentRecipes.filter(item => item.name !== recipe.name);
    
    // 添加到开头
    filteredRecipes.unshift(recipeWithTimestamp);
    
    // 限制数量
    const maxItems = CACHE_CONFIG.maxItems.recentRecipes;
    if (filteredRecipes.length > maxItems) {
      filteredRecipes.splice(maxItems);
    }
    
    return await setStorage(
      CACHE_CONFIG.keys.recentRecipes,
      filteredRecipes,
      CACHE_CONFIG.expiration.recentRecipes
    );
  } catch (error) {
    console.error('保存最近菜谱失败:', error);
    return false;
  }
}

/**
 * 获取最近的菜谱
 * @returns {Promise<Array>} 最近菜谱列表
 */
async function getRecentRecipes() {
  try {
    const recipes = await getStorage(CACHE_CONFIG.keys.recentRecipes);
    return Array.isArray(recipes) ? recipes : [];
  } catch (error) {
    console.error('获取最近菜谱失败:', error);
    return [];
  }
}

/**
 * 清空最近菜谱
 * @returns {Promise<Boolean>} 清空是否成功
 */
function clearRecentRecipes() {
  return removeStorage(CACHE_CONFIG.keys.recentRecipes);
}

/**
 * 保存用户偏好设置
 * @param {Object} preferences 偏好设置
 * @returns {Promise<Boolean>} 保存是否成功
 */
function saveUserPreferences(preferences) {
  return setStorage(
    CACHE_CONFIG.keys.userPreferences,
    preferences,
    CACHE_CONFIG.expiration.userPreferences
  );
}

/**
 * 获取用户偏好设置
 * @returns {Promise<Object>} 用户偏好设置
 */
async function getUserPreferences() {
  try {
    const preferences = await getStorage(CACHE_CONFIG.keys.userPreferences);
    return preferences || {
      preferredCuisine: '',
      defaultDifficulty: 'medium',
      showNutritionInfo: true,
      enableNotifications: true
    };
  } catch (error) {
    console.error('获取用户偏好失败:', error);
    return {
      preferredCuisine: '',
      defaultDifficulty: 'medium',
      showNutritionInfo: true,
      enableNotifications: true
    };
  }
}

module.exports = {
  setStorage,
  getStorage,
  removeStorage,
  clearStorage,
  getStorageInfo,
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  saveRecentRecipe,
  getRecentRecipes,
  clearRecentRecipes,
  saveUserPreferences,
  getUserPreferences
};