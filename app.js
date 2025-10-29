const { setupGlobalErrorHandler } = require('./utils/errorHandler');

App({
  onLaunch() {
    // 设置全局错误处理
    setupGlobalErrorHandler();
    
    // 检查微信版本
    this.checkWeChatVersion();
    
    console.log('识食有方小程序启动');
  },
  
  onShow() {
    // 小程序显示时的处理
  },
  
  onHide() {
    // 小程序隐藏时的处理
  },
  
  onError(error) {
    console.error('小程序发生错误:', error);
  },
  
  /**
   * 检查微信版本兼容性
   */
  checkWeChatVersion() {
    const systemInfo = wx.getSystemInfoSync();
    const wechatVersion = systemInfo.version;
    
    // 检查是否支持所需的API
    if (!wx.chooseMedia) {
      wx.showModal({
        title: '版本提示',
        content: '当前微信版本过低，部分功能可能无法正常使用，建议升级到最新版本。',
        showCancel: false
      });
    }
    
    this.globalData.systemInfo = systemInfo;
  },
  
  globalData: {
    // 系统信息
    systemInfo: null,
    
    // 用户信息
    userInfo: null,
    
    // 应用状态
    appStatus: {
      isLoading: false,
      currentPage: 'index'
    },
    
    // 缓存数据
    cache: {
      recentRecipes: [],
      searchHistory: []
    }
  }
})