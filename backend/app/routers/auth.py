from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.models.utilisateur import Utilisateur
from app.core.auth import verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Utilisateur).where(Utilisateur.email == payload.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.mot_de_passe):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    if not user.actif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    return LoginResponse(
        access_token=token,
        role=user.role,
        nom=user.nom
    )