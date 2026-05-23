from pydantic import BaseModel
from app.models.enums import StatutChauffeurEnum
from typing import Optional

class ChauffeurCreate(BaseModel):
    nom: str
    email: str
    mot_de_passe: str
    telephone: Optional[str] = None
    ville: Optional[str] = None  # Ville: Nouakchott, Nouadhibou, Rosso, Kaédi
    warehouse_id: Optional[int] = None
    statut: StatutChauffeurEnum = StatutChauffeurEnum.DISPONIBLE

class ChauffeurUpdate(BaseModel):
    nom: Optional[str] = None
    telephone: Optional[str] = None
    ville: Optional[str] = None
    warehouse_id: Optional[int] = None
    statut: Optional[StatutChauffeurEnum] = None

class ChauffeurResponse(BaseModel):
    id: int
    nom: str
    email: str
    telephone: Optional[str] = None
    ville: Optional[str] = None
    warehouse_id: Optional[int] = None
    statut: Optional[StatutChauffeurEnum] = None
    actif: bool

    model_config = {"from_attributes": True}