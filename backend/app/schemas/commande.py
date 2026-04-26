from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional
from app.models.enums import StatutCommandeEnum

class CommandeCreate(BaseModel):
    adresse_enlevement: str
    adresse_livraison: str
    lat_enlevement: float
    lon_enlevement: float
    lat_livraison: float
    lon_livraison: float
    poids: float
    volume: float
    date_livraison: date
    heure_ouverture: time
    heure_fermeture: time

class CommandeUpdate(BaseModel):
    statut: StatutCommandeEnum

class CommandeAffecter(BaseModel):
    vehicule_id: int
    chauffeur_id: int

class CommandeResponse(BaseModel):
    id: int
    expediteur_id: int
    adresse_enlevement: str
    adresse_livraison: str
    lat_enlevement: float
    lon_enlevement: float
    lat_livraison: float
    lon_livraison: float
    poids: float
    volume: float
    date_livraison: date
    heure_ouverture: time
    heure_fermeture: time
    statut: StatutCommandeEnum
    vehicule_id: Optional[int] = None
    chauffeur_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}