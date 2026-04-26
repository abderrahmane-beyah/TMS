from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.auth import decode_token
from app.models.utilisateur import Utilisateur
from app.models.enums import RoleEnum

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Utilisateur:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    result = await db.execute(select(Utilisateur).where(Utilisateur.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.actif:
        raise credentials_exception

    return user

def require_role(*roles: RoleEnum):
    async def role_checker(
        current_user: Utilisateur = Depends(get_current_user)
    ) -> Utilisateur:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès non autorisé"
            )
        return current_user
    return role_checker