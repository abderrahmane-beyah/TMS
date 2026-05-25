#!/bin/bash
# Script de démarrage pour Render.com
# Lance le backend ET le worker Celery dans le même processus

# Démarrer Celery worker en arrière-plan
celery -A app.solver.tasks worker --loglevel=info &

# Démarrer FastAPI
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
