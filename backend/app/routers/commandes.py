from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.database import get_db
from app.models.commande import Commande
from app.models.enums import StatutCommandeEnum, RoleEnum
from app.schemas.commande import CommandeCreate, CommandeUpdate, CommandeEdit, CommandeAffecter, CommandeResponse
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/commandes", tags=["Commandes"])

@router.get("/", response_model=list[CommandeResponse])
async def list_commandes(
    statut: Optional[StatutCommandeEnum] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = select(Commande)

    # L'expéditeur ne voit que ses propres commandes
    if current_user.role == RoleEnum.EXPEDITEUR:
        query = query.where(Commande.expediteur_id == current_user.id)

    if statut:
        query = query.where(Commande.statut == statut)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=CommandeResponse, status_code=status.HTTP_201_CREATED)
async def create_commande(
    payload: CommandeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(RoleEnum.EXPEDITEUR, RoleEnum.ADMINISTRATEUR))
):
    commande = Commande(**payload.model_dump(), expediteur_id=current_user.id)
    db.add(commande)
    await db.commit()
    await db.refresh(commande)
    return commande


@router.get("/{commande_id}", response_model=CommandeResponse)
async def get_commande(
    commande_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    result = await db.execute(select(Commande).where(Commande.id == commande_id))
    commande = result.scalar_one_or_none()
    if not commande:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if current_user.role == RoleEnum.EXPEDITEUR and commande.expediteur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    return commande


@router.patch("/{commande_id}", response_model=CommandeResponse)
async def update_commande(
    commande_id: int,
    payload: CommandeEdit,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    """
    Modifier les détails d'une commande.
    - Les commandes EN_ATTENTE peuvent être modifiées librement
    - Les commandes AFFECTÉE peuvent être modifiées, mais seront réinitialisées à EN_ATTENTE et retirées des tournées
    - Les commandes EN_COURS, LIVRÉE, ANNULÉE ne peuvent pas être modifiées
    """
    result = await db.execute(select(Commande).where(Commande.id == commande_id))
    commande = result.scalar_one_or_none()
    if not commande:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if current_user.role == RoleEnum.CHAUFFEUR:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if current_user.role == RoleEnum.EXPEDITEUR and commande.expediteur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if commande.statut not in [StatutCommandeEnum.EN_ATTENTE, StatutCommandeEnum.AFFECTEE]:
        raise HTTPException(
            status_code=400,
            detail="Seules les commandes en attente ou affectées peuvent être modifiées"
        )

    # Si la commande est AFFECTÉE, la réinitialiser à EN_ATTENTE et la retirer des tournées
    if commande.statut == StatutCommandeEnum.AFFECTEE:
        from app.models.tournee import StopTournee, Tournee

        stops_result = await db.execute(
            select(StopTournee).where(StopTournee.commande_id == commande_id)
        )
        stops = stops_result.scalars().all()

        affected_tournee_ids = set(stop.tournee_id for stop in stops)

        for stop in stops:
            await db.delete(stop)

        await db.flush()

        # Supprimer les tournées qui n'ont plus d'arrêts
        for tournee_id in affected_tournee_ids:
            remaining_stops = await db.execute(
                select(StopTournee).where(StopTournee.tournee_id == tournee_id)
            )
            if not remaining_stops.scalars().first():
                tournee_result = await db.execute(
                    select(Tournee).where(Tournee.id == tournee_id)
                )
                tournee = tournee_result.scalar_one_or_none()
                if tournee:
                    await db.delete(tournee)

        commande.statut = StatutCommandeEnum.EN_ATTENTE
        commande.vehicule_id = None
        commande.chauffeur_id = None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(commande, field, value)

    await db.commit()
    await db.refresh(commande)
    return commande

@router.patch("/{commande_id}/statut", response_model=CommandeResponse)
async def update_statut(
    commande_id: int,
    payload: CommandeUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: Utilisateur = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Commande).where(Commande.id == commande_id))
    commande = result.scalar_one_or_none()
    if not commande:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    commande.statut = payload.statut
    await db.commit()
    await db.refresh(commande)
    return commande


@router.patch("/{commande_id}/affecter", response_model=CommandeResponse)
async def affecter_commande(
    commande_id: int,
    payload: CommandeAffecter,
    db: AsyncSession = Depends(get_db),
    _current_user: Utilisateur = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Commande).where(Commande.id == commande_id))
    commande = result.scalar_one_or_none()
    if not commande:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    commande.vehicule_id = payload.vehicule_id
    commande.chauffeur_id = payload.chauffeur_id
    commande.statut = StatutCommandeEnum.AFFECTEE
    await db.commit()
    await db.refresh(commande)
    return commande


@router.delete("/{commande_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_commande(
    commande_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    result = await db.execute(select(Commande).where(Commande.id == commande_id))
    commande = result.scalar_one_or_none()
    if not commande:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    if current_user.role == RoleEnum.CHAUFFEUR:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if current_user.role == RoleEnum.EXPEDITEUR and commande.expediteur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if commande.statut == StatutCommandeEnum.EN_ATTENTE:
        await db.delete(commande)
    elif commande.statut in [StatutCommandeEnum.AFFECTEE, StatutCommandeEnum.EN_COURS]:
        from app.models.tournee import StopTournee, Tournee

        stops_result = await db.execute(
            select(StopTournee).where(StopTournee.commande_id == commande_id)
        )
        stops = stops_result.scalars().all()

        affected_tournee_ids = set(stop.tournee_id for stop in stops)

        for stop in stops:
            await db.delete(stop)

        await db.flush()

        # Supprimer les tournées qui n'ont plus d'arrêts
        for tournee_id in affected_tournee_ids:
            remaining_stops = await db.execute(
                select(StopTournee).where(StopTournee.tournee_id == tournee_id)
            )
            if not remaining_stops.scalars().first():
                tournee_result = await db.execute(
                    select(Tournee).where(Tournee.id == tournee_id)
                )
                tournee = tournee_result.scalar_one_or_none()
                if tournee:
                    await db.delete(tournee)

        commande.statut = StatutCommandeEnum.ANNULEE
        commande.vehicule_id = None
        commande.chauffeur_id = None
    else:
        raise HTTPException(
            status_code=400,
            detail="Les commandes livrées ne peuvent pas être annulées"
        )

    await db.commit()
    