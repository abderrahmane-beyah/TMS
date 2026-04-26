from pydantic import BaseModel, computed_field
from datetime import date, datetime
from typing import Optional, Any
from app.models.enums import AlgorithmeEnum, StatutTacheEnum


class LancerOptimisationRequest(BaseModel):
    algorithme: AlgorithmeEnum
    commande_ids: list[int]
    vehicule_ids: list[int]
    date: date


class TacheLanceeResponse(BaseModel):
    tache_id: int


class TacheStatutResponse(BaseModel):
    id: int
    statut: StatutTacheEnum
    progression: int
    algorithme: AlgorithmeEnum

    model_config = {"from_attributes": True}


class TacheResultatResponse(BaseModel):
    id: int
    algorithme: AlgorithmeEnum
    statut: StatutTacheEnum
    progression: int
    distance_totale: Optional[float] = None
    nb_vehicules_utilises: Optional[int] = None
    nb_commandes_non_servies: Optional[int] = None
    resultat_json: Optional[Any] = None
    temps_execution: Optional[float] = None
    date_execution: Optional[datetime] = None
    created_at: datetime

    @computed_field
    @property
    def date(self) -> Optional[str]:
        return str(self.date_execution.date()) if self.date_execution else None

    model_config = {"from_attributes": True}
