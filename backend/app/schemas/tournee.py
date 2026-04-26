from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from app.models.enums import StatutTourneeEnum, StatutStopEnum

class StopResponse(BaseModel):
    id: int
    commande_id: int
    adresse: str
    lat: float
    lon: float
    ordre: int
    heure_arrivee_prevue: Optional[datetime] = None
    heure_arrivee_reelle: Optional[datetime] = None
    statut: StatutStopEnum

    model_config = {"from_attributes": True}

class TourneeResponse(BaseModel):
    id: int
    date: date
    distance_totale: Optional[float] = None
    progression: int
    statut: StatutTourneeEnum
    heure_depart: Optional[datetime] = None
    vehicule_id: int
    chauffeur_id: int
    tache_optimisation_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class TourneeDetailResponse(TourneeResponse):
    stops: list[StopResponse] = []