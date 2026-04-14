#!/bin/bash

# Health Check Script for Withdrawal Engine
# Run this after deployment to verify everything is working

echo "🔍 Checking Withdrawal Engine Health"

# Check if containers are running
echo "📋 Container Status:"
docker-compose ps

# Check application health endpoint
echo "🏥 Application Health Check:"
if curl -f -s http://localhost:8000/health > /dev/null; then
    echo "✅ Application is healthy"
else
    echo "❌ Application health check failed"
fi

# Check database connectivity
echo "🗄️ Database Connectivity:"
docker-compose exec -T web npm run db:check 2>/dev/null || echo "❌ Database check failed"

# Check Redis connectivity
echo "🔴 Redis Connectivity:"
docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG" && echo "✅ Redis is responding" || echo "❌ Redis check failed"

# Check logs for errors
echo "📜 Recent Error Logs:"
docker-compose logs --tail=20 | grep -i error || echo "✅ No recent errors found"

echo "✨ Health check complete"