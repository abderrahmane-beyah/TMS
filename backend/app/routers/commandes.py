from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.database import get_db
from app.models.commande import Commande
from app.models.enums import StatutCommandeEnum, RoleEnum
from app.schemas.commande import CommandeCreate, CommandeUpdate, CommandeAffecter, CommandeResponse
from app.core.dependencies import get_current_user, require_role
from app.models.utilisateur import Utilisateur

router = APIRouter(prefix="/api/v1/commandes", tags=["Commandes"])

@router.get("/", response_model=list[CommandeResponse])
async def list_commandes(
    statut: Optional[StatutCommandeEnum] = Query(None),
    skip: int = Query(0),
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user)
):
    query = select(Commande)

    # Expéditeur sees only their own orders
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
    return commande


@router.patch("/{commande_id}/statut", response_model=CommandeResponse)
async def update_statut(
    commande_id: int,
    payload: CommandeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
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
    current_user: Utilisateur = Depends(require_role(RoleEnum.DISPATCHEUR, RoleEnum.ADMINISTRATEUR))
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
    if commande.statut != StatutCommandeEnum.EN_ATTENTE:
        raise HTTPException(
            status_code=400,
            detail="Seules les commandes EN_ATTENTE peuvent être annulées"
        )
    if current_user.role == RoleEnum.EXPEDITEUR and commande.expediteur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    await db.delete(commande)
    await db.commit()
    