#!/bin/bash

# FoodieFinder 部署脚本
# 用于自动化部署到生产环境

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_NAME="foodiefinder"
DEPLOY_USER="deploy"
DEPLOY_HOST="your-server.com"
DEPLOY_PATH="/opt/foodiefinder"
BACKUP_PATH="/backup/foodiefinder"
DOCKER_COMPOSE_FILE="deploy/docker/docker-compose.yml"

# 函数：打印彩色消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# 函数：检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_message $RED "错误: $1 命令未找到，请先安装"
        exit 1
    fi
}

# 函数：检查环境变量文件
check_env_file() {
    if [ ! -f ".env.production" ]; then
        print_message $RED "错误: .env.production 文件不存在"
        print_message $YELLOW "请复制 .env.production.template 并填入实际配置"
        exit 1
    fi
}

# 函数：备份数据库
backup_database() {
    print_message $BLUE "开始备份数据库..."
    
    # 创建备份目录
    mkdir -p $BACKUP_PATH/$(date +%Y%m%d)
    
    # 备份 MongoDB
    docker exec foodiefinder-mongodb mongodump \
        --host localhost \
        --port 27017 \
        --username $DB_USERNAME \
        --password $DB_PASSWORD \
        --db $DB_NAME \
        --out /backup/$(date +%Y%m%d_%H%M%S)
    
    print_message $GREEN "数据库备份完成"
}

# 函数：构建 Docker 镜像
build_images() {
    print_message $BLUE "开始构建 Docker 镜像..."
    
    # 构建应用镜像
    docker build -t $PROJECT_NAME:latest -f deploy/docker/Dockerfile .
    
    # 标记版本
    local version=$(date +%Y%m%d_%H%M%S)
    docker tag $PROJECT_NAME:latest $PROJECT_NAME:$version
    
    print_message $GREEN "Docker 镜像构建完成: $PROJECT_NAME:$version"
}

# 函数：部署服务
deploy_services() {
    print_message $BLUE "开始部署服务..."
    
    # 停止现有服务
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    # 拉取最新镜像（如果使用远程仓库）
    # docker-compose -f $DOCKER_COMPOSE_FILE pull
    
    # 启动服务
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    print_message $GREEN "服务部署完成"
}

# 函数：健康检查
health_check() {
    print_message $BLUE "开始健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            print_message $GREEN "健康检查通过"
            return 0
        fi
        
        print_message $YELLOW "健康检查失败，重试中... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    print_message $RED "健康检查失败，部署可能有问题"
    return 1
}

# 函数：清理旧镜像
cleanup_images() {
    print_message $BLUE "清理旧的 Docker 镜像..."
    
    # 删除无标签的镜像
    docker image prune -f
    
    # 保留最近5个版本的镜像
    docker images $PROJECT_NAME --format "table {{.Tag}}" | \
        grep -E '^[0-9]{8}_[0-9]{6}$' | \
        sort -r | \
        tail -n +6 | \
        xargs -I {} docker rmi $PROJECT_NAME:{} 2>/dev/null || true
    
    print_message $GREEN "镜像清理完成"
}

# 函数：发送通知
send_notification() {
    local status=$1
    local message=$2
    
    # 这里可以集成钉钉、企业微信等通知服务
    print_message $BLUE "发送部署通知: $message"
    
    # 示例：发送到钉钉机器人
    # curl -X POST "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN" \
    #      -H 'Content-Type: application/json' \
    #      -d "{\"msgtype\": \"text\", \"text\": {\"content\": \"$message\"}}"
}

# 函数：回滚部署
rollback() {
    print_message $YELLOW "开始回滚部署..."
    
    # 获取上一个版本
    local previous_version=$(docker images $PROJECT_NAME --format "table {{.Tag}}" | \
        grep -E '^[0-9]{8}_[0-9]{6}$' | \
        sort -r | \
        sed -n '2p')
    
    if [ -z "$previous_version" ]; then
        print_message $RED "没有找到可回滚的版本"
        exit 1
    fi
    
    print_message $BLUE "回滚到版本: $previous_version"
    
    # 更新 docker-compose 文件中的镜像版本
    sed -i "s/$PROJECT_NAME:latest/$PROJECT_NAME:$previous_version/g" $DOCKER_COMPOSE_FILE
    
    # 重新部署
    deploy_services
    
    # 恢复 docker-compose 文件
    sed -i "s/$PROJECT_NAME:$previous_version/$PROJECT_NAME:latest/g" $DOCKER_COMPOSE_FILE
    
    print_message $GREEN "回滚完成"
}

# 主函数
main() {
    print_message $GREEN "开始 FoodieFinder 部署流程"
    
    # 检查必要的命令
    check_command "docker"
    check_command "docker-compose"
    check_command "curl"
    
    # 检查环境配置
    check_env_file
    
    # 加载环境变量
    source .env.production
    
    # 解析命令行参数
    case "${1:-deploy}" in
        "deploy")
            backup_database
            build_images
            deploy_services
            health_check
            cleanup_images
            send_notification "success" "FoodieFinder 部署成功"
            ;;
        "rollback")
            rollback
            health_check
            send_notification "warning" "FoodieFinder 已回滚到上一版本"
            ;;
        "build")
            build_images
            ;;
        "backup")
            backup_database
            ;;
        "health")
            health_check
            ;;
        "cleanup")
            cleanup_images
            ;;
        *)
            echo "用法: $0 {deploy|rollback|build|backup|health|cleanup}"
            echo "  deploy  - 完整部署流程"
            echo "  rollback - 回滚到上一版本"
            echo "  build   - 仅构建镜像"
            echo "  backup  - 仅备份数据库"
            echo "  health  - 仅健康检查"
            echo "  cleanup - 仅清理镜像"
            exit 1
            ;;
    esac
    
    print_message $GREEN "部署流程完成"
}

# 捕获错误并发送通知
trap 'send_notification "error" "FoodieFinder 部署失败"; exit 1' ERR

# 执行主函数
main "$@"