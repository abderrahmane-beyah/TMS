from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import date
from app.database import get_db
from app.models.tournee import Tournee, StopTournee
from app.models.enums import RoleEnum, StatutTourneeEnum, StatutStopEnum
from app.schemas.tournee import TourneeResponse, TourneeDetailResponse, StopResponse
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/tournees", tags=["Tournées"])


@router.get("/", response_model=list[TourneeResponse])
async def list_tournees(
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    result = await db.execute(select(Tournee).order_by(Tournee.date.desc()))
    return result.scalars().all()


@router.get("/ma-tournee", response_model=TourneeDetailResponse)
async def ma_tournee(
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(RoleEnum.CHAUFFEUR))
):
    today = date.today()
    result = await db.execute(
        select(Tournee)
        .where(Tournee.chauffeur_id == current_user.id, Tournee.date == today)
        .options(selectinload(Tournee.stops))
    )
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Aucune tournée assignée aujourd'hui")
    return tournee


@router.get("/{tournee_id}", response_model=TourneeDetailResponse)
async def get_tournee(
    tournee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    result = await db.execute(
        select(Tournee)
        .where(Tournee.id == tournee_id)
        .options(selectinload(Tournee.stops))
    )
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")
    return tournee


@router.patch("/{tournee_id}/demarrer", response_model=TourneeResponse)
async def demarrer_tournee(
    tournee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR, RoleEnum.CHAUFFEUR)
    )
):
    result = await db.execute(select(Tournee).where(Tournee.id == tournee_id))
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")
    if tournee.statut != StatutTourneeEnum.PLANIFIEE:
        raise HTTPException(status_code=400, detail="La tournée n'est pas en statut PLANIFIEE")
    from datetime import datetime, timezone
    tournee.statut = StatutTourneeEnum.EN_COURS
    tournee.heure_depart = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tournee)
    return tournee


@router.patch("/{tournee_id}/terminer", response_model=TourneeResponse)
async def terminer_tournee(
    tournee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR, RoleEnum.CHAUFFEUR)
    )
):
    result = await db.execute(select(Tournee).where(Tournee.id == tournee_id))
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")
    tournee.statut = StatutTourneeEnum.TERMINEE
    tournee.progression = 100
    await db.commit()
    await db.refresh(tournee)
    return tournee


# ── STOPS ──

@router.patch("/{tournee_id}/stops/{stop_id}/confirmer", response_model=StopResponse)
async def confirmer_livraison(
    tournee_id: int,
    stop_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.CHAUFFEUR, RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR)
    )
):
    result = await db.execute(
        select(StopTournee).where(
            StopTournee.id == stop_id,
            StopTournee.tournee_id == tournee_id
        )
    )
    stop = result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop introuvable")

    # Prevent confirming an already-delivered stop
    if stop.statut == StatutStopEnum.LIVREE:
        raise HTTPException(status_code=400, detail="Cette livraison a déjà été confirmée")

    from datetime import datetime, timezone
    stop.statut = StatutStopEnum.LIVREE
    stop.heure_arrivee_reelle = datetime.now(timezone.utc)

    # Update tournée progression
    all_stops = await db.execute(
        select(StopTournee).where(StopTournee.tournee_id == tournee_id)
    )
    stops = all_stops.scalars().all()
    livres = sum(1 for s in stops if s.statut == StatutStopEnum.LIVREE or s.id == stop_id)
    progression = int((livres / len(stops)) * 100) if stops else 0

    tournee_result = await db.execute(select(Tournee).where(Tournee.id == tournee_id))
    tournee = tournee_result.scalar_one_or_none()
    if tournee:
        tournee.progression = progression

    await db.commit()
    await db.refresh(stop)
    return stop