from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.enums import RoleEnum

class UserCreate(BaseModel):
    nom: str
    email: EmailStr
    mot_de_passe: str
    telephone: Optional[str] = None
    role: RoleEnum

class UserUpdate(BaseModel):
    nom: Optional[str] = None
    telephone: Optional[str] = None
    role: Optional[RoleEnum] = None

class UserResponse(BaseModel):
    id: int
    nom: str
    email: str
    telephone: Optional[str] = None
    role: RoleEnum
    actif: bool

    model_config = {"from_attributes": True}