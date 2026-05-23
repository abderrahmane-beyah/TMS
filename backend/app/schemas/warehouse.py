from pydantic import BaseModel
from datetime import time
from typing import Optional


class WarehouseCreate(BaseModel):
    nom: str
    ville: str
    adresse: str
    lat: float
    lon: float
    heure_ouverture: Optional[time] = None
    heure_fermeture: Optional[time] = None


class WarehouseUpdate(BaseModel):
    nom: Optional[str] = None
    ville: Optional[str] = None
    adresse: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    heure_ouverture: Optional[time] = None
    heure_fermeture: Optional[time] = None
    actif: Optional[bool] = None


class WarehouseResponse(BaseModel):
    id: int
    nom: str
    ville: str
    adresse: str
    lat: float
    lon: float
    heure_ouverture: Optional[time] = None
    heure_fermeture: Optional[time] = None
    actif: bool

    model_config = {"from_attributes": True}
