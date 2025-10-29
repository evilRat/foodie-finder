# FoodieFinder 后端服务 Dockerfile
# 多阶段构建，优化镜像大小

# 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建应用（如果有构建步骤）
# RUN npm run build

# 生产阶段
FROM node:18-alpine AS production

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S foodiefinder -u 1001

# 设置工作目录
WORKDIR /app

# 复制构建产物和依赖
COPY --from=builder --chown=foodiefinder:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=foodiefinder:nodejs /app/package*.json ./
COPY --from=builder --chown=foodiefinder:nodejs /app/config ./config
COPY --from=builder --chown=foodiefinder:nodejs /app/utils ./utils
COPY --from=builder --chown=foodiefinder:nodejs /app/server ./server

# 创建日志目录
RUN mkdir -p /var/log/foodiefinder && \
    chown -R foodiefinder:nodejs /var/log/foodiefinder

# 安装健康检查工具
RUN apk add --no-cache curl

# 切换到非root用户
USER foodiefinder

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "server/app.js"]