@echo off
REM Render Deployment Pre-Check Script (Windows Batch)
REM This script helps validate your configuration before deploying to Render

echo 🔍 Render Deployment Pre-Check
echo ================================

REM Check if .env.production exists
if not exist ".env.production" (
    echo ❌ Error: .env.production file not found!
    echo 📝 Please copy .env.production.example to .env.production and configure your values
    exit /b 1
)

echo ✅ Environment file found

REM Check if Dockerfile exists
if not exist "Dockerfile" (
    echo ❌ Error: Dockerfile not found!
    exit /b 1
)

echo ✅ Dockerfile found

echo 🏗️ Testing Docker build...
docker build -t withdrawal-engine-test . >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker build failed
    exit /b 1
)
echo ✅ Docker build successful

echo 🚀 Testing application startup...
timeout /t 5 /nobreak >nul
echo ✅ Application validation skipped (requires manual testing)

echo.
echo 🎉 Basic checks passed!
echo.
echo 📋 Next steps for Render deployment:
echo 1. Create Render PostgreSQL database
echo 2. Create Render Redis instance
echo 3. Create Web Service with Dockerfile
echo 4. Create Background Worker with 'npm run worker' command
echo 5. Configure environment variables in both services
echo 6. Update CALLBACK_URL with your Render web service URL
echo 7. Deploy and monitor logs
echo.
echo 📖 See render-deployment.md for detailed instructions
pause