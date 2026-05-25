from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.models.optimisation import TacheOptimisation
from app.models.enums import RoleEnum, StatutTacheEnum, AlgorithmeEnum
from app.schemas.optimisation import (
    LancerOptimisationRequest,
    TacheLanceeResponse,
    TacheStatutResponse,
    TacheResultatResponse,
)
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/optimisation", tags=["Optimisation"])


@router.post("/lancer", response_model=TacheLanceeResponse)
async def lancer_optimisation(
    payload: LancerOptimisationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR)
    ),
):
    tache = TacheOptimisation(
        algorithme=AlgorithmeEnum.OR_TOOLS,
        statut=StatutTacheEnum.EN_ATTENTE,
        progression=0,
        date_execution=datetime.now(timezone.utc),
    )
    db.add(tache)
    await db.commit()
    await db.refresh(tache)

    try:
        from app.solver.tasks import run_optimisation
        run_optimisation.delay(
            tache_id=tache.id,
            warehouse_id=payload.warehouse_id,
            commande_ids=payload.commande_ids,
            vehicule_ids=payload.vehicule_ids,
            date_str=str(payload.date),
        )
    except Exception:
        # Celery/broker non disponible — la tâche reste EN_ATTENTE jusqu'à ce qu'un worker la prenne
        pass

    return TacheLanceeResponse(tache_id=tache.id)


@router.get("/historique", response_model=list[TacheResultatResponse])
async def historique_optimisations(
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    result = await db.execute(
        select(TacheOptimisation).order_by(TacheOptimisation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{tache_id}/statut", response_model=TacheStatutResponse)
async def statut_optimisation(
    tache_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    result = await db.execute(
        select(TacheOptimisation).where(TacheOptimisation.id == tache_id)
    )
    tache = result.scalar_one_or_none()
    if not tache:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    return tache


@router.get("/{tache_id}/resultat", response_model=TacheResultatResponse)
async def resultat_optimisation(
    tache_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    result = await db.execute(
        select(TacheOptimisation).where(TacheOptimisation.id == tache_id)
    )
    tache = result.scalar_one_or_none()
    if not tache:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    if tache.statut not in (StatutTacheEnum.TERMINEE, StatutTacheEnum.ERREUR):
        raise HTTPException(
            status_code=400,
            detail=f"Tâche non terminée (statut: {tache.statut.value})",
        )
    return tache
