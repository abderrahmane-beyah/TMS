from pydantic import BaseModel, EmailStr
from app.models.enums import RoleEnum

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum
    nom: str