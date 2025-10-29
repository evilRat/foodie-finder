# 设计文档

## 概述

FoodieFinder是一个基于微信小程序的智能菜谱应用，集成AI图像识别和菜谱生成功能。系统采用前后端分离架构，前端使用微信小程序原生技术栈，后端通过云函数或服务器API提供AI服务。

## 架构设计

### 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   微信小程序     │    │   后端API服务    │    │   AI服务提供商   │
│                │    │                │    │                │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │   首页    │  │    │  │ 图像识别   │  │    │  │  视觉AI   │  │
│  └───────────┘  │    │  │   API     │  │    │  │   模型    │  │
│  ┌───────────┐  │◄──►│  └───────────┘  │◄──►│  └───────────┘  │
│  │ 菜谱详情  │  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  └───────────┘  │    │  │ 菜谱生成   │  │    │  │  语言AI   │  │
│  ┌───────────┐  │    │  │   API     │  │    │  │   模型    │  │
│  │  工具函数  │  │    │  └───────────┘  │    │  └───────────┘  │
│  └───────────┘  │    │                │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技术栈选择

**前端技术栈:**
- 微信小程序原生框架
- WXML (页面结构)
- WXSS (样式)
- JavaScript ES6+ (逻辑)

**后端技术栈:**
- Node.js + Express (API服务器)
- 或微信云开发 (云函数)
- 腾讯云/阿里云 AI服务

**AI服务选择:**
- 图像识别: 腾讯云图像分析、百度AI开放平台、或阿里云视觉智能
- 文本生成: 通义千问、文心一言、或ChatGPT API

## 组件和接口设计

### 前端组件架构

#### 1. 页面组件

**首页 (pages/index)**
```javascript
// index.js 主要方法
{
  data: {
    searchText: '',
    isLoading: false
  },
  
  // 文字搜索
  onSearch: function() {},
  
  // 拍照识别
  onTakePhoto: function() {},
  
  // 相册选择
  onChooseImage: function() {},
  
  // 处理图片识别
  handleImageRecognition: function(imagePath) {},
  
  // 跳转到菜谱页面
  navigateToRecipe: function(foodName) {}
}
```

**菜谱详情页 (pages/recipe)**
```javascript
// recipe.js 主要方法
{
  data: {
    recipe: null,
    isLoading: true,
    error: null
  },
  
  // 页面加载
  onLoad: function(options) {},
  
  // 生成菜谱
  generateRecipe: function(foodName) {},
  
  // 返回首页
  goBack: function() {}
}
```

#### 2. 工具模块

**API服务模块 (utils/api.js)**
```javascript
// API接口封装
{
  // 图像识别API
  recognizeFood: function(imagePath) {},
  
  // 菜谱生成API
  generateRecipe: function(foodName) {},
  
  // 通用请求方法
  request: function(options) {}
}
```

**工具函数模块 (utils/util.js)**
```javascript
// 通用工具函数
{
  // 图片压缩
  compressImage: function(imagePath) {},
  
  // 错误处理
  handleError: function(error) {},
  
  // 加载状态管理
  showLoading: function(title) {},
  hideLoading: function() {}
}
```

### 后端API接口设计

#### 1. 图像识别接口

**POST /api/recognize-food**

请求参数:
```json
{
  "image": "base64编码的图片数据",
  "imageType": "jpg|png"
}
```

响应格式:
```json
{
  "success": true,
  "data": {
    "foodName": "红烧肉",
    "confidence": 0.95,
    "alternatives": ["东坡肉", "糖醋里脊"]
  },
  "message": "识别成功"
}
```

#### 2. 菜谱生成接口

**POST /api/generate-recipe**

请求参数:
```json
{
  "foodName": "红烧肉",
  "cuisine": "川菜|粤菜|鲁菜|苏菜|浙菜|闽菜|湘菜|徽菜",
  "difficulty": "简单|中等|困难"
}
```

响应格式:
```json
{
  "success": true,
  "data": {
    "name": "红烧肉",
    "cuisine": "川菜",
    "cookingTime": "45分钟",
    "difficulty": "中等",
    "servings": "2-3人份",
    "ingredients": [
      {
        "name": "五花肉",
        "amount": "500g",
        "note": "选择肥瘦相间的"
      }
    ],
    "steps": [
      {
        "stepNumber": 1,
        "description": "将五花肉切成2cm见方的块状",
        "tip": "切块大小要均匀"
      }
    ],
    "tips": [
      "炖煮过程中要小火慢炖",
      "最后收汁时要大火快炒"
    ],
    "nutrition": {
      "calories": "320kcal/100g",
      "protein": "15g",
      "fat": "28g"
    }
  }
}
```

## 数据模型

### 菜谱数据模型

```javascript
// Recipe Model
{
  id: String,              // 菜谱ID
  name: String,            // 菜品名称
  cuisine: String,         // 菜系
  cookingTime: String,     // 烹饪时间
  difficulty: String,      // 难度等级
  servings: String,        // 份量
  description: String,     // 菜品描述
  
  ingredients: [{          // 食材列表
    name: String,          // 食材名称
    amount: String,        // 用量
    note: String           // 备注
  }],
  
  steps: [{               // 制作步骤
    stepNumber: Number,    // 步骤序号
    description: String,   // 步骤描述
    tip: String,          // 小贴士
    image: String         // 步骤图片(可选)
  }],
  
  tips: [String],         // 烹饪贴士
  
  nutrition: {            // 营养信息
    calories: String,     // 热量
    protein: String,      // 蛋白质
    fat: String,         // 脂肪
    carbs: String        // 碳水化合物
  },
  
  createdAt: Date,        // 创建时间
  updatedAt: Date         // 更新时间
}
```

### 识别结果数据模型

```javascript
// Recognition Result Model
{
  foodName: String,           // 识别出的食物名称
  confidence: Number,         // 置信度 (0-1)
  alternatives: [String],     // 备选结果
  boundingBox: {             // 边界框(可选)
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  processingTime: Number      // 处理时间(毫秒)
}
```

## 错误处理

### 错误类型定义

```javascript
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
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};
```

### 错误处理策略

1. **网络错误**: 提供重试机制，最多重试3次
2. **图像识别失败**: 提示用户重新拍照或选择其他图片
3. **菜谱生成失败**: 提供手动输入食物名称的备选方案
4. **服务器错误**: 显示友好的错误提示，建议稍后重试

## 测试策略

### 单元测试

**工具函数测试**
- 图片压缩功能测试
- API请求封装测试
- 错误处理函数测试

**组件测试**
- 页面组件渲染测试
- 用户交互事件测试
- 数据绑定测试

### 集成测试

**API集成测试**
- 图像识别API调用测试
- 菜谱生成API调用测试
- 错误场景处理测试

**端到端测试**
- 完整用户流程测试
- 不同设备兼容性测试
- 网络异常情况测试

### 性能测试

**响应时间测试**
- 图像识别响应时间 < 5秒
- 菜谱生成响应时间 < 30秒
- 页面加载时间 < 2秒

**资源使用测试**
- 内存使用监控
- 网络流量监控
- 图片压缩效果测试

## AI提示词设计

### 菜谱生成专业提示词

```
你是一位资深的中餐烹饪专家，拥有30年的烹饪经验，精通中国八大菜系。请根据用户提供的食物名称，生成一份详细、专业、易于家庭制作的菜谱。

要求：
1. 菜谱必须符合传统中餐制作工艺
2. 食材用量适合2-3人份的家庭制作
3. 步骤描述要详细具体，包含火候、时间等关键信息
4. 提供实用的烹饪技巧和注意事项
5. 包含营养价值说明

输出格式：
- 菜品名称：[菜名]
- 所属菜系：[川菜/粤菜/鲁菜/苏菜/浙菜/闽菜/湘菜/徽菜]
- 烹饪时间：[准备时间 + 制作时间]
- 难度等级：[简单/中等/困难]
- 份量：[X人份]

食材清单：
[详细列出所有食材及用量]

制作步骤：
[按顺序详细描述每个步骤]

烹饪贴士：
[提供3-5个实用的烹饪技巧]

营养价值：
[简要说明主要营养成分和食用建议]

食物名称：{foodName}
```

### 图像识别结果优化提示词

```
你是一位食物识别专家。请分析识别结果，如果置信度较低或存在多个可能结果，请提供最合理的判断。

识别原则：
1. 优先识别常见的中式菜品和食材
2. 考虑食物的外观特征、颜色、形状
3. 如果无法确定具体菜品，识别主要食材
4. 提供2-3个备选结果供用户选择

输出要求：
- 主要结果：最可能的食物名称
- 置信度：0-1之间的数值
- 备选结果：其他可能的食物名称
- 识别依据：简要说明判断理由

识别结果：{recognitionResult}
```

## 部署和配置

### 微信小程序配置

**app.json 配置**
```json
{
  "pages": [
    "pages/index/index",
    "pages/recipe/recipe"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "识食有方",
    "navigationBarTextStyle": "black"
  },
  "permission": {
    "scope.camera": {
      "desc": "用于拍照识别食物"
    },
    "scope.album": {
      "desc": "用于选择相册图片识别食物"
    }
  },
  "requiredBackgroundModes": ["audio"],
  "networkTimeout": {
    "request": 30000,
    "uploadFile": 30000
  }
}
```

### 服务器部署配置

**环境变量配置**
```bash
# AI服务配置
AI_VISION_API_KEY=your_vision_api_key
AI_TEXT_API_KEY=your_text_api_key
AI_SERVICE_ENDPOINT=https://api.example.com

# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置(如需要)
DATABASE_URL=mongodb://localhost:27017/foodiefinder

# 日志配置
LOG_LEVEL=info
```

**Nginx配置示例**
```nginx
server {
    listen 443 ssl;
    server_name api.foodiefinder.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增加超时时间用于AI处理
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```