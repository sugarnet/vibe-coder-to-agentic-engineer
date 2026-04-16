#!/bin/bash

# Project Management MVP - Stop Script for Linux/Mac
# This script stops the Docker container

CONTAINER_NAME="kanban-api"

echo "🛑 Stopping Kanban API..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    exit 1
fi

# Check if container exists
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "⏹️  Stopping container..."
    docker stop "$CONTAINER_NAME" || true
    
    echo "🗑️  Removing container..."
    docker rm "$CONTAINER_NAME" || true
    
    echo "✅ Container stopped and removed"
else
    echo "ℹ️  Container is not running"
fi

# Optional: Remove image (comment out if you want to keep it)
# if docker images | grep -q kanban-api; then
#     echo "🗑️  Removing image..."
#     docker rmi kanban-api || true
# fi
