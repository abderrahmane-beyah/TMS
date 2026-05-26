#!/bin/bash
# Script de démarrage Docker
# Lance le backend ET le worker Celery dans le même processus

# Attendre que la base de données soit prête
echo " Waiting for database..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h db -U postgres -d tms_db -c '\q' 2>/dev/null; do
  sleep 1
done

# Vérifier si la base de données est vide
TABLE_COUNT=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h db -U postgres -d tms_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" = "0" ]; then
  echo "Importing database from export..."
  PGPASSWORD=$POSTGRES_PASSWORD psql -h db -U postgres -d tms_db < database_export.sql
  echo " Database imported successfully"
else
  echo " Database already exists (found $TABLE_COUNT tables)"
fi

echo " Starting Celery worker..."
celery -A app.solver.tasks worker --loglevel=info &

echo " Starting FastAPI..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
