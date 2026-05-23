from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.models.enums import RoleEnum, StatutChauffeurEnum
from app.schemas.chauffeur import ChauffeurCreate, ChauffeurUpdate, ChauffeurResponse
from app.core.dependencies import get_current_user, require_role
from app.core.auth import hash_password

router = APIRouter(prefix="/api/v1/chauffeurs", tags=["Chauffeurs"])

@router.get("/", response_model=list[ChauffeurResponse])
async def list_chauffeurs(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.role == RoleEnum.CHAUFFEUR)
    )
    chauffeurs = result.scalars().all()
    for c in chauffeurs:
        if not hasattr(c, 'statut') or c.statut is None:
            c.statut = StatutChauffeurEnum.DISPONIBLE
    return chauffeurs

@router.post("/", response_model=ChauffeurResponse, status_code=status.HTTP_201_CREATED)
async def create_chauffeur(
    payload: ChauffeurCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    chauffeur = Utilisateur(
        nom=payload.nom,
        email=payload.email,
        mot_de_passe=hash_password(payload.mot_de_passe),
        telephone=payload.telephone,
        role=RoleEnum.CHAUFFEUR,
        statut=payload.statut,
        actif=True
    )
    db.add(chauffeur)
    await db.commit()
    await db.refresh(chauffeur)
    return chauffeur

@router.patch("/{chauffeur_id}", response_model=ChauffeurResponse)
async def update_chauffeur(
    chauffeur_id: int,
    payload: ChauffeurUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(
        select(Utilisateur).where(
            Utilisateur.id == chauffeur_id,
            Utilisateur.role == RoleEnum.CHAUFFEUR
        )
    )
    chauffeur = result.scalar_one_or_none()
    if not chauffeur:
        raise HTTPException(status_code=404, detail="Chauffeur introuvable")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(chauffeur, key, value)
    await db.commit()
    await db.refresh(chauffeur)
    return chauffeur