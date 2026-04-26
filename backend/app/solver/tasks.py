from celery import Celery
from app.config import settings

celery_app = Celery(
    "tms",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_BROKER_URL,
)


@celery_app.task(name="tms.run_optimisation", bind=True)
def run_optimisation(self, tache_id: int, commande_ids: list, vehicule_ids: list, date_str: str):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.optimisation import TacheOptimisation
    from app.models.enums import StatutTacheEnum
    from datetime import datetime, timezone

    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql+psycopg2://"
    )
    engine = create_engine(sync_url)

    with Session(engine) as db:
        tache = db.get(TacheOptimisation, tache_id)
        if not tache:
            return

        tache.statut = StatutTacheEnum.EN_COURS
        tache.progression = 0
        db.commit()

        try:
            # Solvers are not yet implemented
            raise NotImplementedError("Solveur non encore implémenté")
        except Exception as exc:
            tache.statut = StatutTacheEnum.ERREUR
            tache.resultat_json = {"erreur": str(exc)}
            db.commit()
