from pydantic import BaseModel
from app.models.enums import StatutVehiculeEnum

class VehiculeCreate(BaseModel):
    immatriculation: str
    capacite_poids: float
    capacite_volume: float
    statut: StatutVehiculeEnum = StatutVehiculeEnum.DISPONIBLE

class VehiculeUpdate(BaseModel):
    immatriculation: str | None = None
    capacite_poids: float | None = None
    capacite_volume: float | None = None
    statut: StatutVehiculeEnum | None = None

class VehiculeResponse(BaseModel):
    id: int
    immatriculation: str
    capacite_poids: float
    capacite_volume: float
    statut: StatutVehiculeEnum

    model_config = {"from_attributes": True}