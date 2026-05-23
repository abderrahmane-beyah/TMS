from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import StatutVehiculeEnum, VehiculeTypeEnum

class Vehicule(Base):
    __tablename__ = "vehicules"

    id              = Column(Integer, primary_key=True, index=True)
    immatriculation = Column(String, unique=True, nullable=False)
    capacite_poids  = Column(Float, nullable=False)
    capacite_volume = Column(Float, nullable=False)
    ville           = Column(String, nullable=True)  
    warehouse_id    = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    statut          = Column(SAEnum(StatutVehiculeEnum), default=StatutVehiculeEnum.DISPONIBLE)
    type_vehicule   = Column(SAEnum(VehiculeTypeEnum), nullable=False, server_default='normal')

    # Relations
    warehouse = relationship("Warehouse", back_populates="vehicules")
    tournees  = relationship("Tournee", back_populates="vehicule")
    commandes = relationship("Commande", back_populates="vehicule")