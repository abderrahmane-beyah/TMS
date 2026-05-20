from sqlalchemy import Column, Integer, String, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.enums import StatutVehiculeEnum

class Vehicule(Base):
    __tablename__ = "vehicules"

    id              = Column(Integer, primary_key=True, index=True)
    immatriculation = Column(String, unique=True, nullable=False)
    capacite_poids  = Column(Float, nullable=False)
    capacite_volume = Column(Float, nullable=False)
    ville           = Column(String, nullable=True)  # City where vehicle is based (Nouakchott, Nouadhibou, etc.)
    statut          = Column(SAEnum(StatutVehiculeEnum), default=StatutVehiculeEnum.DISPONIBLE)

    # Relationships
    tournees  = relationship("Tournee", back_populates="vehicule")
    commandes = relationship("Commande", back_populates="vehicule")