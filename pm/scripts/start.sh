#!/bin/bash

# Project Management MVP - Start Script for Linux/Mac
# This script builds and starts the Docker container

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="kanban-api"
PORT="8000"
IMAGE_NAME="kanban-api"

echo "🚀 Starting Kanban API..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Stop and remove existing container if running
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "🛑 Stopping existing container..."
    docker stop "$CONTAINER_NAME" || true
    docker rm "$CONTAINER_NAME" || true
fi

# Build the Docker image
echo "🔨 Building Docker image..."
cd "$PROJECT_ROOT"
docker build -t "$IMAGE_NAME" .

# Start the container
echo "🏃 Starting container on port $PORT..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:$PORT" \
    --env-file .env \
    "$IMAGE_NAME" \
    uvicorn main:app --host 0.0.0.0 --port $PORT

# Wait for the service to be ready
echo "⏳ Waiting for service to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
        echo "✅ Kanban API is running at http://localhost:$PORT"
        echo "📖 API Documentation: http://localhost:$PORT/docs"
        exit 0
    fi
    sleep 1
done

echo "❌ Service failed to start within 30 seconds"
echo "📋 Check logs with: docker logs $CONTAINER_NAME"
exit 1
    exit 1
fi

# Check if container is already running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "⏹️  Container already running. Stopping it first..."
    docker stop "$CONTAINER_NAME" || true
    docker rm "$CONTAINER_NAME" || true
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -t "$IMAGE_NAME" "$PROJECT_ROOT"

# Run container
echo "🐳 Starting container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8000" \
    --env-file "$PROJECT_ROOT/.env" \
    "$IMAGE_NAME"

# Wait for container to be ready
echo "⏳ Waiting for server to be ready..."
sleep 2

# Check health
for i in {1..30}; do
    if curl -s http://localhost:$PORT/api/health > /dev/null; then
        echo "✅ Server is ready!"
        echo "🌐 API available at http://localhost:$PORT"
        echo "📊 Health check: http://localhost:$PORT/api/health"
        echo "📝 To view logs: docker logs -f $CONTAINER_NAME"
        echo "🛑 To stop: ./scripts/stop.sh"
        exit 0
    fi
    echo "   Attempt $i/30..."
    sleep 1
done

echo "❌ Server did not start in time"
docker logs "$CONTAINER_NAME"
exit 1
