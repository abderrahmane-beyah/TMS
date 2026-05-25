from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.database import get_db
from app.models.anomalie import Anomalie
from app.models.enums import RoleEnum, StatutAnomalieEnum
from app.schemas.anomalie import AnomalieCreate, AnomalieResponse
from app.core.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/v1/anomalies", tags=["Anomalies"])

@router.get("/", response_model=list[AnomalieResponse])
async def list_anomalies(
    statut: Optional[StatutAnomalieEnum] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Anomalie)
    if statut:
        query = query.where(Anomalie.statut == statut)
    query = query.order_by(Anomalie.date_signalement.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=AnomalieResponse, status_code=201)
async def create_anomalie(
    payload: AnomalieCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Valider que la tournée existe
    from app.models.tournee import Tournee, StopTournee
    tournee_result = await db.execute(
        select(Tournee).where(Tournee.id == payload.tournee_id)
    )
    tournee = tournee_result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail=f"Tournée #{payload.tournee_id} introuvable")

    # Si stop_id est fourni, valider qu'il existe et appartient à la tournée
    if payload.stop_id is not None:
        stop_result = await db.execute(
            select(StopTournee).where(StopTournee.id == payload.stop_id)
        )
        stop = stop_result.scalar_one_or_none()
        if not stop:
            raise HTTPException(status_code=404, detail=f"Arrêt #{payload.stop_id} introuvable")
        if stop.tournee_id != payload.tournee_id:
            raise HTTPException(
                status_code=400,
                detail=f"L'arrêt #{payload.stop_id} n'appartient pas à la tournée #{payload.tournee_id}"
            )

    anomalie = Anomalie(**payload.model_dump())
    db.add(anomalie)
    await db.commit()
    await db.refresh(anomalie)
    return anomalie

@router.patch("/{anomalie_id}/resoudre", response_model=AnomalieResponse)
async def resoudre_anomalie(
    anomalie_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Anomalie).where(Anomalie.id == anomalie_id))
    anomalie = result.scalar_one_or_none()
    if not anomalie:
        raise HTTPException(status_code=404, detail="Anomalie introuvable")
    anomalie.statut = StatutAnomalieEnum.RESOLUE
    await db.commit()
    await db.refresh(anomalie)
    return anomalie