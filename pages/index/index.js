Page({
  data: {
    inputValue: '',
    imageSrc: '',
    recognizedFood: '',
    isProcessing: false
  },

  onLoad() {
    // 页面加载时执行
  },

  // 输入框内容变化时
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 清空输入框
  clearInput() {
    this.setData({
      inputValue: ''
    });
  },

  // 拍照识别
  takePhoto() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera'],
      success: (res) => {
        this.setData({
          imageSrc: res.tempFilePaths[0],
          isProcessing: true
        });
        
        // 模拟图片处理过程
        setTimeout(() => {
          this.setData({
            recognizedFood: '红烧肉',
            isProcessing: false
          });
          
          // 跳转到菜谱页面
          wx.navigateTo({
            url: `/pages/recipe/recipe?food=${this.data.recognizedFood}`
          });
        }, 2000);
      }
    });
  },

  // 从相册选择
  chooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album'],
      success: (res) => {
        this.setData({
          imageSrc: res.tempFilePaths[0],
          isProcessing: true
        });
        
        // 模拟图片处理过程
        setTimeout(() => {
          this.setData({
            recognizedFood: '宫保鸡丁',
            isProcessing: false
          });
          
          // 跳转到菜谱页面
          wx.navigateTo({
            url: `/pages/recipe/recipe?food=${this.data.recognizedFood}`
          });
        }, 2000);
      }
    });
  },

  // 根据文字搜索
  searchByInput() {
    if (this.data.inputValue.trim()) {
      wx.navigateTo({
        url: `/pages/recipe/recipe?food=${this.data.inputValue}`
      });
    } else {
      wx.showToast({
        title: '请输入食物名称',
        icon: 'none'
      });
    }
  }
});