# FoodieFinder 生产环境部署指南

## 概述

本文档详细说明了如何将 FoodieFinder 应用部署到生产环境。部署包括微信小程序前端和后端 API 服务。

## 系统要求

### 服务器要求
- **操作系统**: Ubuntu 20.04 LTS 或 CentOS 8+
- **CPU**: 2核心以上
- **内存**: 4GB 以上
- **存储**: 50GB 以上 SSD
- **网络**: 公网 IP 地址，支持 HTTPS

### 软件要求
- Docker 20.10+
- Docker Compose 2.0+
- Nginx 1.18+
- Git 2.25+

## 部署前准备

### 1. 域名和 SSL 证书

```bash
# 购买域名并配置 DNS 解析
api.foodiefinder.com -> 服务器IP
cdn.foodiefinder.com -> 服务器IP
www.foodiefinder.com -> 服务器IP
```

### 2. 微信小程序配置

1. 登录微信公众平台 (mp.weixin.qq.com)
2. 创建小程序并获取 AppID 和 AppSecret
3. 配置服务器域名:
   - request 合法域名: `https://api.foodiefinder.com`
   - upload 合法域名: `https://api.foodiefinder.com`
   - download 合法域名: `https://cdn.foodiefinder.com`

### 3. AI 服务申请

#### 腾讯云图像识别
1. 注册腾讯云账号
2. 开通图像分析服务
3. 获取 SecretId 和 SecretKey

#### 阿里云通义千问
1. 注册阿里云账号
2. 开通 DashScope 服务
3. 获取 API Key

### 4. 服务器初始化

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 创建部署目录
sudo mkdir -p /opt/foodiefinder
sudo chown $USER:$USER /opt/foodiefinder
```

## 部署步骤

### 1. 克隆代码

```bash
cd /opt/foodiefinder
git clone https://github.com/your-org/foodiefinder.git .
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.production.template .env.production

# 编辑配置文件
nano .env.production
```

**重要配置项**:
```bash
# 微信小程序
WECHAT_APP_ID=your_production_app_id
WECHAT_APP_SECRET=your_production_app_secret

# AI 服务
AI_VISION_API_KEY=your_vision_api_key
AI_TEXT_API_KEY=your_text_api_key

# 数据库
DB_HOST=your_mongodb_host
DB_USERNAME=your_db_username
DB_PASSWORD=your_secure_password

# 安全
JWT_SECRET=your_jwt_secret_min_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars
```

### 3. 设置 SSL 证书

```bash
# 使用 Let's Encrypt 自动获取证书
chmod +x deploy/scripts/setup-ssl.sh
./deploy/scripts/setup-ssl.sh setup
```

### 4. 部署应用

```bash
# 使用部署脚本
chmod +x deploy/scripts/deploy.sh
./deploy/scripts/deploy.sh deploy
```

### 5. 验证部署

```bash
# 检查服务状态
docker-compose -f deploy/docker/docker-compose.yml ps

# 检查健康状态
curl https://api.foodiefinder.com/health

# 查看日志
docker-compose -f deploy/docker/docker-compose.yml logs -f app
```

## 微信小程序发布

### 1. 更新配置

编辑 `project.config.json`:
```json
{
  "appid": "your_production_app_id",
  "setting": {
    "urlCheck": true,
    "minified": true
  }
}
```

### 2. 上传代码

1. 使用微信开发者工具打开项目
2. 点击"上传"按钮
3. 填写版本号和项目备注
4. 上传代码到微信后台

### 3. 提交审核

1. 登录微信公众平台
2. 进入"版本管理"
3. 提交审核并填写相关信息
4. 等待审核通过后发布

## 监控和维护

### 1. 日志监控

```bash
# 查看应用日志
docker logs foodiefinder-app -f

# 查看 Nginx 日志
docker logs foodiefinder-nginx -f

# 查看数据库日志
docker logs foodiefinder-mongodb -f
```

### 2. 性能监控

```bash
# 查看系统资源使用
docker stats

# 查看磁盘使用
df -h

# 查看内存使用
free -h
```

### 3. 备份策略

```bash
# 手动备份数据库
./deploy/scripts/deploy.sh backup

# 设置自动备份 (每天凌晨2点)
echo "0 2 * * * /opt/foodiefinder/deploy/scripts/deploy.sh backup" | crontab -
```

### 4. 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./deploy/scripts/deploy.sh deploy
```

### 5. 回滚部署

```bash
# 回滚到上一版本
./deploy/scripts/deploy.sh rollback
```

## 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep :3000
   
   # 检查 Docker 服务
   sudo systemctl status docker
   ```

2. **SSL 证书问题**
   ```bash
   # 检查证书有效期
   openssl x509 -in /etc/letsencrypt/live/api.foodiefinder.com/cert.pem -text -noout
   
   # 手动续期证书
   ./deploy/scripts/setup-ssl.sh renew
   ```

3. **数据库连接失败**
   ```bash
   # 检查 MongoDB 状态
   docker exec foodiefinder-mongodb mongo --eval "db.adminCommand('ismaster')"
   
   # 重启数据库
   docker-compose restart mongodb
   ```

4. **AI 服务调用失败**
   ```bash
   # 检查 API 密钥配置
   grep AI_.*_API_KEY .env.production
   
   # 测试 API 连接
   curl -H "Authorization: Bearer $AI_TEXT_API_KEY" https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
   ```

### 日志分析

```bash
# 查看错误日志
docker logs foodiefinder-app 2>&1 | grep ERROR

# 查看访问日志
docker exec foodiefinder-nginx tail -f /var/log/nginx/access.log

# 查看慢查询日志
docker exec foodiefinder-mongodb tail -f /var/log/mongodb/mongod.log
```

## 安全建议

1. **定期更新系统和依赖**
   ```bash
   sudo apt update && sudo apt upgrade -y
   docker-compose pull
   ```

2. **配置防火墙**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **定期备份**
   - 数据库备份保留30天
   - 代码备份使用 Git
   - 配置文件备份到安全位置

4. **监控异常访问**
   - 配置访问日志分析
   - 设置异常告警
   - 定期检查安全日志

## 性能优化

1. **数据库优化**
   ```bash
   # 创建索引
   db.recipes.createIndex({ "name": 1 })
   db.users.createIndex({ "openid": 1 })
   ```

2. **缓存优化**
   - 启用 Redis 缓存
   - 配置 CDN 加速
   - 优化图片压缩

3. **服务器优化**
   - 调整 Nginx 工作进程数
   - 优化数据库连接池
   - 配置负载均衡（如需要）

## 联系支持

如果在部署过程中遇到问题，请联系技术支持：

- 邮箱: support@foodiefinder.com
- 文档: https://docs.foodiefinder.com
- 问题反馈: https://github.com/your-org/foodiefinder/issues