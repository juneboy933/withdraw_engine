#!/bin/bash

# Render Deployment Helper Script
# This script helps validate your configuration before deploying to Render

echo "🔍 Render Deployment Pre-Check"
echo "================================"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "📝 Please copy .env.production.example to .env.production and configure your values"
    exit 1
fi

echo "✅ Environment file found"

# Check required environment variables
required_vars=(
    "DB_HOST"
    "DB_PASSWORD"
    "REDIS_URL"
    "JWT_SECRET"
    "MPESA_CONSUMER_KEY"
    "MPESA_CONSUMER_SECRET"
    "MPESA_CALLBACK_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env.production; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '  - %s\n' "${missing_vars[@]}"
    echo "📝 Please add these to your .env.production file"
    exit 1
fi

echo "✅ All required environment variables present"

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found!"
    exit 1
fi

echo "✅ Dockerfile found"

# Test Docker build
echo "🏗️ Testing Docker build..."
if docker build -t withdrawal-engine-test . > /dev/null 2>&1; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Test application startup (basic)
echo "🚀 Testing application startup..."
if timeout 10s docker run --rm -p 8000:8000 withdrawal-engine-test npm start > /dev/null 2>&1; then
    echo "✅ Application starts successfully"
else
    echo "❌ Application failed to start"
    exit 1
fi

echo ""
echo "🎉 Pre-deployment checks passed!"
echo ""
echo "📋 Next steps for Render deployment:"
echo "1. Create Render PostgreSQL database"
echo "2. Create Render Redis instance"
echo "3. Create Web Service with Dockerfile"
echo "4. Create Background Worker with 'npm run worker' command"
echo "5. Configure environment variables in both services"
echo "6. Update CALLBACK_URL with your Render web service URL"
echo "7. Deploy and monitor logs"
echo ""
echo "📖 See render-deployment.md for detailed instructions"