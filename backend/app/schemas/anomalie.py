from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.enums import TypeAnomalieEnum, StatutAnomalieEnum

class AnomalieCreate(BaseModel):
    tournee_id: int
    stop_id: Optional[int] = None
    type: TypeAnomalieEnum
    description: str

class AnomalieResponse(BaseModel):
    id: int
    tournee_id: int
    stop_id: Optional[int] = None
    type: TypeAnomalieEnum
    description: str
    date_signalement: datetime
    statut: StatutAnomalieEnum

    model_config = {"from_attributes": True}