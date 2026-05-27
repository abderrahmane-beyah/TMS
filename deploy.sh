#!/bin/bash
set -e

echo "Deploiement TMS Production..."
cd ~/TMS

# Pull latest code
echo "Recuperation du code..."
git pull origin main
git fetch origin
git reset --hard origin/main

# Stop containers
echo "Arret des conteneurs..."
docker compose -f docker-compose.prod.yml --env-file .env.production down

# Rebuild images with no cache
echo "Reconstruction des images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

# Start containers
echo "Demarrage des conteneurs..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "Deploiement termine!"                                                                 
echo "Frontend: http://116.203.75.64"                                                       
echo "Backend API: http://116.203.75.64:8000"                                               
echo "API Docs: http://116.203.75.64:8000/docs"
