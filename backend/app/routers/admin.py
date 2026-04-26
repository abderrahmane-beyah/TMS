from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.utilisateur import Utilisateur
from app.models.enums import RoleEnum
from app.schemas.admin import UserCreate, UserUpdate, UserResponse
from app.core.dependencies import require_role
from app.core.auth import hash_password

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(select(Utilisateur))
    return result.scalars().all()

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    # Check email not already taken
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.email == payload.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    user = Utilisateur(
        nom=payload.nom,
        email=payload.email,
        mot_de_passe=hash_password(payload.mot_de_passe),
        telephone=payload.telephone,
        role=payload.role,
        actif=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/users/{user_id}/toggle-actif", response_model=UserResponse)
async def toggle_actif(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMINISTRATEUR))
):
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez pas désactiver votre propre compte"
        )
    user.actif = not user.actif
    await db.commit()
    await db.refresh(user)
    return user