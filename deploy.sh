#!/bin/bash

# Production Deployment Script for Withdrawal Engine
# This script handles deployment to a production server

set -e  # Exit on any error

echo "🚀 Starting Withdrawal Engine Production Deployment"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "📝 Please copy .env.production.example to .env.production and configure your values"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "📦 Pulling latest images..."
docker-compose pull

echo "🛑 Stopping existing containers..."
docker-compose down

echo "🧹 Cleaning up unused resources..."
docker system prune -f

echo "🏗️ Building application..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Deployment successful!"
    echo "🌐 Application should be available at http://localhost:8000"
    echo "📊 Check logs with: docker-compose logs -f"
    echo "🛑 Stop with: docker-compose down"
else
    echo "❌ Deployment failed. Check logs:"
    docker-compose logs
    exit 1
fi