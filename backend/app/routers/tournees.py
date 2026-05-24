from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import date
from app.database import get_db
from app.models.tournee import Tournee, StopTournee
from app.models.commande import Commande
from app.models.enums import RoleEnum, StatutTourneeEnum, StatutStopEnum, StatutCommandeEnum
from app.schemas.tournee import TourneeResponse, TourneeDetailResponse, StopResponse, TourneeUpdate
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/tournees", tags=["Tournées"])


@router.get("/", response_model=list[TourneeDetailResponse])
async def list_tournees(
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    # Les chauffeurs ne voient que leurs propres tournées
    # Les dispatcheurs et admins voient toutes les tournées
    if current_user.role == RoleEnum.CHAUFFEUR:
        result = await db.execute(
            select(Tournee)
            .where(Tournee.chauffeur_id == current_user.id)
            .options(selectinload(Tournee.stops))
            .order_by(Tournee.date.desc())
        )
    else:
        result = await db.execute(
            select(Tournee)
            .options(selectinload(Tournee.stops))
            .order_by(Tournee.date.desc())
        )

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
        .options(
            selectinload(Tournee.stops).selectinload(StopTournee.commande)
        )
        .order_by(
            Tournee.statut.desc(),
            Tournee.heure_depart.asc()
        )
    )
    tournees = result.scalars().all()
    if not tournees:
        raise HTTPException(status_code=404, detail="Aucune tournée assignée aujourd'hui")

    tournee = next((t for t in tournees if t.statut == StatutTourneeEnum.EN_COURS), None)
    if not tournee:
        tournee = next((t for t in tournees if t.statut == StatutTourneeEnum.PLANIFIEE), None)
    if not tournee:
        tournee = tournees[0]

    if tournee and tournee.stops:
        for stop in tournee.stops:
            if hasattr(stop, 'commande') and stop.commande:
                stop.commande_statut = stop.commande.statut

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
        .options(
            selectinload(Tournee.stops).selectinload(StopTournee.commande)
        )
    )
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")

    if current_user.role == RoleEnum.CHAUFFEUR and tournee.chauffeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if tournee and tournee.stops:
        for stop in tournee.stops:
            if hasattr(stop, 'commande') and stop.commande:
                stop.commande_statut = stop.commande.statut

    return tournee


@router.patch("/{tournee_id}", response_model=TourneeResponse)
async def update_tournee(
    tournee_id: int,
    data: TourneeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(
        require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR)
    )
):
    result = await db.execute(select(Tournee).where(Tournee.id == tournee_id))
    tournee = result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")

    if tournee.statut != StatutTourneeEnum.PLANIFIEE:
        raise HTTPException(
            status_code=400,
            detail="Seules les tournées planifiées peuvent être modifiées"
        )

    if data.chauffeur_id is not None:
        from app.models.utilisateur import Utilisateur
        chauffeur_result = await db.execute(
            select(Utilisateur).where(Utilisateur.id == data.chauffeur_id)
        )
        chauffeur = chauffeur_result.scalar_one_or_none()
        if not chauffeur or chauffeur.role != RoleEnum.CHAUFFEUR:
            raise HTTPException(status_code=404, detail="Chauffeur introuvable")
        tournee.chauffeur_id = data.chauffeur_id

    if data.vehicule_id is not None:
        from app.models.vehicule import Vehicule
        vehicule_result = await db.execute(
            select(Vehicule).where(Vehicule.id == data.vehicule_id)
        )
        vehicule = vehicule_result.scalar_one_or_none()
        if not vehicule:
            raise HTTPException(status_code=404, detail="Véhicule introuvable")
        tournee.vehicule_id = data.vehicule_id

    await db.commit()
    await db.refresh(tournee)
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

    if current_user.role == RoleEnum.CHAUFFEUR and tournee.chauffeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if tournee.statut != StatutTourneeEnum.PLANIFIEE:
        raise HTTPException(status_code=400, detail="La tournée n'est pas en statut PLANIFIEE")
    from datetime import datetime, timezone
    tournee.statut = StatutTourneeEnum.EN_COURS
    tournee.heure_depart = datetime.now(timezone.utc)

    # Marquer toutes les commandes de cette tournée comme EN_COURS
    stops_result = await db.execute(
        select(StopTournee).where(StopTournee.tournee_id == tournee_id)
    )
    stops = stops_result.scalars().all()
    for stop in stops:
        if stop.commande_id:
            commande_result = await db.execute(
                select(Commande).where(Commande.id == stop.commande_id)
            )
            commande = commande_result.scalar_one_or_none()
            if commande and commande.statut == StatutCommandeEnum.AFFECTEE:
                commande.statut = StatutCommandeEnum.EN_COURS

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

    if current_user.role == RoleEnum.CHAUFFEUR and tournee.chauffeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if tournee.statut != StatutTourneeEnum.EN_COURS:
        raise HTTPException(status_code=400, detail="Seules les tournées en cours peuvent être terminées")

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

    tournee_result = await db.execute(select(Tournee).where(Tournee.id == tournee_id))
    tournee = tournee_result.scalar_one_or_none()
    if not tournee:
        raise HTTPException(status_code=404, detail="Tournée introuvable")

    if current_user.role == RoleEnum.CHAUFFEUR and tournee.chauffeur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if stop.statut == StatutStopEnum.LIVREE:
        raise HTTPException(status_code=400, detail="Cette livraison a déjà été confirmée")

    from datetime import datetime, timezone
    stop.statut = StatutStopEnum.LIVREE
    stop.heure_arrivee_reelle = datetime.now(timezone.utc)

    if stop.commande_id:
        commande_result = await db.execute(
            select(Commande).where(Commande.id == stop.commande_id)
        )
        commande = commande_result.scalar_one_or_none()
        if commande:
            commande.statut = StatutCommandeEnum.LIVREE

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