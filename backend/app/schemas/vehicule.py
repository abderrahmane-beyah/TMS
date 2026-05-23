from pydantic import BaseModel
from typing import Optional
from app.models.enums import StatutVehiculeEnum, VehiculeTypeEnum

class VehiculeCreate(BaseModel):
    immatriculation: str
    capacite_poids: float
    capacite_volume: float
    type_vehicule: VehiculeTypeEnum = VehiculeTypeEnum.normal  # Type de véhicule: normal, refrigere, congelateur
    ville: str | None = None  # Ville: Nouakchott, Nouadhibou, Rosso, Kaédi
    warehouse_id: Optional[int] = None
    statut: StatutVehiculeEnum = StatutVehiculeEnum.DISPONIBLE

class VehiculeUpdate(BaseModel):
    immatriculation: str | None = None
    capacite_poids: float | None = None
    capacite_volume: float | None = None
    type_vehicule: VehiculeTypeEnum | None = None
    ville: str | None = None
    warehouse_id: Optional[int] = None
    statut: StatutVehiculeEnum | None = None

class VehiculeResponse(BaseModel):
    id: int
    immatriculation: str
    capacite_poids: float
    capacite_volume: float
    type_vehicule: VehiculeTypeEnum  # Type de véhicule: normal, refrigere, congelateur
    ville: str | None = None
    warehouse_id: Optional[int] = None
    statut: StatutVehiculeEnum

    model_config = {"from_attributes": True}