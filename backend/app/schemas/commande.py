from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional
from app.models.enums import StatutCommandeEnum, VehiculeTypeEnum

class CommandeCreate(BaseModel):
    warehouse_id: int  # Entrepôt d'enlèvement
    adresse_livraison: str
    lat_livraison: float
    lon_livraison: float
    poids: float
    volume: float
    date_livraison: date
    heure_ouverture: time
    heure_fermeture: time
    type_vehicule_requis: Optional[VehiculeTypeEnum] = None  # Type de véhicule requis (None = tous types acceptés)

class CommandeUpdate(BaseModel):
    statut: StatutCommandeEnum

class CommandeEdit(BaseModel):
    warehouse_id: Optional[int] = None
    adresse_livraison: Optional[str] = None
    lat_livraison: Optional[float] = None
    lon_livraison: Optional[float] = None
    poids: Optional[float] = None
    volume: Optional[float] = None
    date_livraison: Optional[date] = None
    heure_ouverture: Optional[time] = None
    heure_fermeture: Optional[time] = None
    type_vehicule_requis: Optional[VehiculeTypeEnum] = None

class CommandeAffecter(BaseModel):
    vehicule_id: int
    chauffeur_id: int

class CommandeResponse(BaseModel):
    id: int
    expediteur_id: int
    expediteur_nom: Optional[str] = None
    warehouse_id: Optional[int] = None
    adresse_livraison: str
    lat_livraison: float
    lon_livraison: float
    poids: float
    volume: float
    date_livraison: date
    heure_ouverture: time
    heure_fermeture: time
    statut: StatutCommandeEnum
    type_vehicule_requis: Optional[VehiculeTypeEnum] = None  # Type de véhicule requis (None = tous types acceptés)
    vehicule_id: Optional[int] = None
    chauffeur_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}