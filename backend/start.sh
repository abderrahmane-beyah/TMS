#!/bin/bash
# Script de démarrage pour Render.com
# Lance le backend ET le worker Celery dans le même processus

echo " Running database migrations..."
alembic upgrade head

echo "Seeding database (if needed)..."
python seed.py

echo " Starting Celery worker..."
celery -A app.solver.tasks worker --loglevel=info &

echo " Starting FastAPI..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
