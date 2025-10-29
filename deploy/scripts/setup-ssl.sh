#!/bin/bash

# SSL 证书设置脚本
# 用于配置 Let's Encrypt SSL 证书

set -e

# 配置变量
DOMAIN="api.foodiefinder.com"
EMAIL="admin@foodiefinder.com"
WEBROOT="/var/www/certbot"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# 检查 certbot 是否安装
check_certbot() {
    if ! command -v certbot &> /dev/null; then
        print_message $YELLOW "安装 certbot..."
        
        # Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot
        # CentOS/RHEL
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot
        else
            print_message $RED "无法自动安装 certbot，请手动安装"
            exit 1
        fi
    fi
}

# 创建 webroot 目录
setup_webroot() {
    print_message $BLUE "设置 webroot 目录..."
    sudo mkdir -p $WEBROOT
    sudo chown -R www-data:www-data $WEBROOT
}

# 获取 SSL 证书
obtain_certificate() {
    print_message $BLUE "获取 SSL 证书..."
    
    sudo certbot certonly \
        --webroot \
        --webroot-path=$WEBROOT \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --domains $DOMAIN
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "SSL 证书获取成功"
    else
        print_message $RED "SSL 证书获取失败"
        exit 1
    fi
}

# 设置证书自动续期
setup_auto_renewal() {
    print_message $BLUE "设置证书自动续期..."
    
    # 创建续期脚本
    cat > /tmp/renew-ssl.sh << 'EOF'
#!/bin/bash
certbot renew --quiet
if [ $? -eq 0 ]; then
    # 重启 nginx
    docker-compose -f /opt/foodiefinder/deploy/docker/docker-compose.yml restart nginx
fi
EOF
    
    sudo mv /tmp/renew-ssl.sh /usr/local/bin/renew-ssl.sh
    sudo chmod +x /usr/local/bin/renew-ssl.sh
    
    # 添加到 crontab
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/renew-ssl.sh") | crontab -
    
    print_message $GREEN "自动续期设置完成"
}

# 复制证书到 Docker 目录
copy_certificates() {
    print_message $BLUE "复制证书到 Docker 目录..."
    
    local ssl_dir="/opt/foodiefinder/deploy/ssl"
    sudo mkdir -p $ssl_dir
    
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $ssl_dir/foodiefinder.crt
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $ssl_dir/foodiefinder.key
    
    # 设置权限
    sudo chown -R root:root $ssl_dir
    sudo chmod 644 $ssl_dir/foodiefinder.crt
    sudo chmod 600 $ssl_dir/foodiefinder.key
    
    print_message $GREEN "证书复制完成"
}

# 测试 SSL 配置
test_ssl() {
    print_message $BLUE "测试 SSL 配置..."
    
    # 等待服务启动
    sleep 10
    
    if curl -f https://$DOMAIN/health > /dev/null 2>&1; then
        print_message $GREEN "SSL 配置测试通过"
    else
        print_message $YELLOW "SSL 配置测试失败，请检查配置"
    fi
}

# 主函数
main() {
    print_message $GREEN "开始 SSL 证书设置"
    
    case "${1:-setup}" in
        "setup")
            check_certbot
            setup_webroot
            obtain_certificate
            setup_auto_renewal
            copy_certificates
            print_message $GREEN "SSL 证书设置完成"
            ;;
        "renew")
            certbot renew
            copy_certificates
            print_message $GREEN "SSL 证书续期完成"
            ;;
        "test")
            test_ssl
            ;;
        *)
            echo "用法: $0 {setup|renew|test}"
            echo "  setup - 初始设置 SSL 证书"
            echo "  renew - 续期 SSL 证书"
            echo "  test  - 测试 SSL 配置"
            exit 1
            ;;
    esac
}

main "$@"