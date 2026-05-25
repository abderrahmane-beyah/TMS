from pydantic import BaseModel, computed_field
from datetime import date, datetime
from typing import Optional, Any
from app.models.enums import AlgorithmeEnum, StatutTacheEnum


class LancerOptimisationRequest(BaseModel):
    warehouse_id: int
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
    nb_commandes_totales: Optional[int] = None
    nb_commandes_non_servies: Optional[int] = None
    resultat_json: Optional[Any] = None
    temps_execution: Optional[float] = None
    cpu_usage_percent: Optional[float] = None  # Utilisation CPU en pourcentage
    memory_usage_mb: Optional[float] = None    # Utilisation mémoire en MB
    date_execution: Optional[datetime] = None
    created_at: datetime

    @computed_field
    @property
    def nb_commandes_servies(self) -> Optional[int]:
        """Nombre de commandes servies = total - non servies"""
        if self.nb_commandes_totales is not None and self.nb_commandes_non_servies is not None:
            return self.nb_commandes_totales - self.nb_commandes_non_servies
        return None

    @computed_field
    @property
    def date(self) -> Optional[str]:
        return str(self.date_execution.date()) if self.date_execution else None

    model_config = {"from_attributes": True}
