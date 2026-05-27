#!/bin/bash
set -e

echo " Déploiement TMS Production..."

cd ~/TMS

# Pull latest code
echo " Récupération du code..."
git pull origin main

# Stop containers
echo " Arrêt des conteneurs..."
docker compose -f docker-compose.prod.yml --env-file .env.production down

# Rebuild images with no cache
echo "Reconstruction des images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

# Start containers
echo " Démarrage des conteneurs..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo ""
echo " Déploiement terminé!"
echo " Frontend: http://116.203.75.64"
echo " Backend API: http://116.203.75.64:8000"
echo " API Docs: http://116.203.75.64:8000/docs"
