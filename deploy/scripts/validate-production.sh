#!/bin/bash

# 生产环境验证脚本
# 用于验证生产环境配置是否正确

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
DOMAIN="api.foodiefinder.com"
API_ENDPOINT="https://$DOMAIN"
HEALTH_ENDPOINT="$API_ENDPOINT/health"

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# 检查环境变量
check_environment() {
    print_message $BLUE "检查环境变量配置..."
    
    local missing_vars=()
    local required_vars=(
        "WECHAT_APP_ID"
        "WECHAT_APP_SECRET"
        "AI_VISION_API_KEY"
        "AI_TEXT_API_KEY"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "DB_HOST"
        "DB_USERNAME"
        "DB_PASSWORD"
    )
    
    # 加载环境变量
    if [ -f ".env.production" ]; then
        source .env.production
    else
        print_message $RED "错误: .env.production 文件不存在"
        return 1
    fi
    
    # 检查必需变量
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_message $RED "缺少以下环境变量:"
        printf '%s\n' "${missing_vars[@]}"
        return 1
    fi
    
    print_message $GREEN "环境变量检查通过"
}

# 检查 Docker 服务
check_docker_services() {
    print_message $BLUE "检查 Docker 服务状态..."
    
    local services=("foodiefinder-app" "foodiefinder-mongodb" "foodiefinder-redis" "foodiefinder-nginx")
    local failed_services=()
    
    for service in "${services[@]}"; do
        if ! docker ps --format "table {{.Names}}" | grep -q "^$service$"; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        print_message $RED "以下服务未运行:"
        printf '%s\n' "${failed_services[@]}"
        return 1
    fi
    
    print_message $GREEN "Docker 服务检查通过"
}

# 检查网络连通性
check_network() {
    print_message $BLUE "检查网络连通性..."
    
    # 检查域名解析
    if ! nslookup $DOMAIN > /dev/null 2>&1; then
        print_message $RED "域名解析失败: $DOMAIN"
        return 1
    fi
    
    # 检查端口连通性
    local ports=(80 443)
    for port in "${ports[@]}"; do
        if ! nc -z $DOMAIN $port 2>/dev/null; then
            print_message $RED "端口 $port 不可达"
            return 1
        fi
    done
    
    print_message $GREEN "网络连通性检查通过"
}

# 检查 SSL 证书
check_ssl_certificate() {
    print_message $BLUE "检查 SSL 证书..."
    
    # 检查证书有效性
    local cert_info=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ -z "$cert_info" ]; then
        print_message $RED "无法获取 SSL 证书信息"
        return 1
    fi
    
    # 检查证书过期时间
    local expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
    local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo 0)
    local current_timestamp=$(date +%s)
    local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
    
    if [ $days_until_expiry -lt 30 ]; then
        print_message $YELLOW "SSL 证书将在 $days_until_expiry 天后过期"
    fi
    
    if [ $days_until_expiry -lt 0 ]; then
        print_message $RED "SSL 证书已过期"
        return 1
    fi
    
    print_message $GREEN "SSL 证书检查通过 (有效期: $days_until_expiry 天)"
}

# 检查 API 健康状态
check_api_health() {
    print_message $BLUE "检查 API 健康状态..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response $HEALTH_ENDPOINT)
    
    if [ "$response" != "200" ]; then
        print_message $RED "API 健康检查失败 (HTTP $response)"
        if [ -f "/tmp/health_response" ]; then
            cat /tmp/health_response
        fi
        return 1
    fi
    
    # 检查响应内容
    if [ -f "/tmp/health_response" ]; then
        local health_status=$(cat /tmp/health_response | jq -r '.status' 2>/dev/null || echo "unknown")
        if [ "$health_status" != "ok" ]; then
            print_message $RED "API 健康状态异常: $health_status"
            return 1
        fi
    fi
    
    print_message $GREEN "API 健康检查通过"
}

# 检查数据库连接
check_database() {
    print_message $BLUE "检查数据库连接..."
    
    # 检查 MongoDB 连接
    local mongo_status=$(docker exec foodiefinder-mongodb mongo --quiet --eval "db.adminCommand('ismaster').ismaster" 2>/dev/null || echo "false")
    
    if [ "$mongo_status" != "true" ]; then
        print_message $RED "MongoDB 连接失败"
        return 1
    fi
    
    # 检查 Redis 连接
    local redis_status=$(docker exec foodiefinder-redis redis-cli ping 2>/dev/null || echo "FAIL")
    
    if [ "$redis_status" != "PONG" ]; then
        print_message $RED "Redis 连接失败"
        return 1
    fi
    
    print_message $GREEN "数据库连接检查通过"
}

# 检查 AI 服务
check_ai_services() {
    print_message $BLUE "检查 AI 服务配置..."
    
    # 加载环境变量
    source .env.production
    
    # 检查图像识别服务
    if [ -n "$AI_VISION_API_KEY" ]; then
        # 这里可以添加实际的 API 测试调用
        print_message $GREEN "图像识别服务配置正常"
    else
        print_message $RED "图像识别服务 API Key 未配置"
        return 1
    fi
    
    # 检查文本生成服务
    if [ -n "$AI_TEXT_API_KEY" ]; then
        # 这里可以添加实际的 API 测试调用
        print_message $GREEN "文本生成服务配置正常"
    else
        print_message $RED "文本生成服务 API Key 未配置"
        return 1
    fi
    
    print_message $GREEN "AI 服务检查通过"
}

# 检查系统资源
check_system_resources() {
    print_message $BLUE "检查系统资源..."
    
    # 检查磁盘空间
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $disk_usage -gt 80 ]; then
        print_message $YELLOW "磁盘使用率较高: ${disk_usage}%"
    fi
    
    # 检查内存使用
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $memory_usage -gt 80 ]; then
        print_message $YELLOW "内存使用率较高: ${memory_usage}%"
    fi
    
    # 检查 CPU 负载
    local cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    local load_percentage=$(echo "$cpu_load $cpu_cores" | awk '{printf "%.0f", ($1/$2)*100}')
    
    if [ $load_percentage -gt 80 ]; then
        print_message $YELLOW "CPU 负载较高: ${load_percentage}%"
    fi
    
    print_message $GREEN "系统资源检查完成"
    print_message $BLUE "磁盘使用: ${disk_usage}%, 内存使用: ${memory_usage}%, CPU负载: ${load_percentage}%"
}

# 检查日志
check_logs() {
    print_message $BLUE "检查应用日志..."
    
    # 检查最近的错误日志
    local error_count=$(docker logs foodiefinder-app --since="1h" 2>&1 | grep -i error | wc -l)
    
    if [ $error_count -gt 10 ]; then
        print_message $YELLOW "最近1小时内发现 $error_count 个错误日志"
    fi
    
    # 检查 Nginx 访问日志
    local nginx_errors=$(docker exec foodiefinder-nginx tail -n 100 /var/log/nginx/error.log 2>/dev/null | wc -l)
    
    if [ $nginx_errors -gt 0 ]; then
        print_message $YELLOW "Nginx 错误日志中有 $nginx_errors 条记录"
    fi
    
    print_message $GREEN "日志检查完成"
}

# 性能测试
performance_test() {
    print_message $BLUE "执行性能测试..."
    
    # API 响应时间测试
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" $HEALTH_ENDPOINT)
    local response_ms=$(echo "$response_time * 1000" | bc)
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        print_message $YELLOW "API 响应时间较慢: ${response_ms}ms"
    else
        print_message $GREEN "API 响应时间正常: ${response_ms}ms"
    fi
    
    # 并发测试 (简单版本)
    print_message $BLUE "执行并发测试..."
    local concurrent_requests=10
    local success_count=0
    
    for i in $(seq 1 $concurrent_requests); do
        if curl -f -s $HEALTH_ENDPOINT > /dev/null 2>&1; then
            ((success_count++))
        fi &
    done
    
    wait
    
    local success_rate=$(echo "scale=2; $success_count * 100 / $concurrent_requests" | bc)
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        print_message $YELLOW "并发测试成功率: ${success_rate}%"
    else
        print_message $GREEN "并发测试成功率: ${success_rate}%"
    fi
}

# 生成报告
generate_report() {
    print_message $BLUE "生成验证报告..."
    
    local report_file="/tmp/production_validation_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > $report_file << EOF
FoodieFinder 生产环境验证报告
生成时间: $(date)
服务器: $(hostname)
域名: $DOMAIN

系统信息:
- 操作系统: $(lsb_release -d | cut -f2)
- 内核版本: $(uname -r)
- Docker版本: $(docker --version)

服务状态:
$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

资源使用:
- 磁盘使用: $(df -h / | awk 'NR==2 {print $5}')
- 内存使用: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
- CPU负载: $(uptime | awk -F'load average:' '{print $2}')

网络测试:
- API响应时间: $(curl -o /dev/null -s -w "%{time_total}s" $HEALTH_ENDPOINT)
- SSL证书有效期: $(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)

验证结果: 通过
EOF
    
    print_message $GREEN "验证报告已生成: $report_file"
    cat $report_file
}

# 主函数
main() {
    print_message $GREEN "开始生产环境验证"
    
    local failed_checks=0
    
    # 执行各项检查
    check_environment || ((failed_checks++))
    check_docker_services || ((failed_checks++))
    check_network || ((failed_checks++))
    check_ssl_certificate || ((failed_checks++))
    check_api_health || ((failed_checks++))
    check_database || ((failed_checks++))
    check_ai_services || ((failed_checks++))
    check_system_resources || ((failed_checks++))
    check_logs || ((failed_checks++))
    
    # 性能测试 (可选)
    if [ "${1:-}" = "--performance" ]; then
        performance_test || ((failed_checks++))
    fi
    
    # 生成报告
    if [ $failed_checks -eq 0 ]; then
        generate_report
        print_message $GREEN "所有检查通过，生产环境配置正常"
        exit 0
    else
        print_message $RED "发现 $failed_checks 个问题，请检查并修复"
        exit 1
    fi
}

# 清理临时文件
cleanup() {
    rm -f /tmp/health_response
}

trap cleanup EXIT

main "$@"