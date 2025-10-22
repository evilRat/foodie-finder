Page({
  data: {
    foodName: '',
    recipe: null,
    loading: true
  },

  onLoad(options) {
    if (options.food) {
      this.setData({
        foodName: options.food
      });
      this.loadRecipe(options.food);
    }
  },

  loadRecipe(foodName) {
    // 模拟从AI获取菜谱数据
    this.setData({ loading: true });
    
    // 模拟网络请求延迟
    setTimeout(() => {
      const recipeData = {
        name: foodName,
        ingredients: [
          { name: '五花肉', amount: '500克' },
          { name: '生姜', amount: '3片' },
          { name: '葱', amount: '2根' },
          { name: '料酒', amount: '2勺' },
          { name: '老抽', amount: '1勺' },
          { name: '生抽', amount: '2勺' },
          { name: '冰糖', amount: '10颗' },
          { name: '八角', amount: '2个' }
        ],
        steps: [
          '五花肉切成2厘米见方的块儿',
          '锅中放少许油，放入五花肉煎至表面微黄',
          '加入冰糖翻炒至上色',
          '加入料酒、老抽、生抽翻炒均匀',
          '加入生姜、葱段和八角翻炒',
          '加入开水没过肉块，大火烧开后转小火炖煮40分钟',
          '最后大火收汁即可'
        ],
        tips: '收汁时要不断搅拌，防止粘锅。可以根据个人口味调整调料用量。',
        cookingTime: '约60分钟',
        difficulty: '中等'
      };
      
      this.setData({
        recipe: recipeData,
        loading: false
      });
    }, 1500);
  },

  // 返回首页
  goHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },

  // 重新搜索
  searchAgain() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  }
});