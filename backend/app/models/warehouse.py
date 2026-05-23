from sqlalchemy import Column, Integer, String, Float, Time, Boolean
from sqlalchemy.orm import relationship
from datetime import time as dt_time
from app.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id                  = Column(Integer, primary_key=True, index=True)
    nom                 = Column(String, nullable=False)
    ville               = Column(String, nullable=False)  # Une ville peut avoir plusieurs entrepôts
    adresse             = Column(String, nullable=False)
    lat                 = Column(Float, nullable=False)
    lon                 = Column(Float, nullable=False)
    heure_ouverture     = Column(Time, default=dt_time(6, 0))   # 6:00 AM
    heure_fermeture     = Column(Time, default=dt_time(20, 0))  # 8:00 PM
    actif               = Column(Boolean, default=True)

    # Relationships
    vehicules   = relationship("Vehicule", back_populates="warehouse")
    chauffeurs  = relationship("Utilisateur", foreign_keys="Utilisateur.warehouse_id", back_populates="warehouse")
    commandes   = relationship("Commande", back_populates="warehouse")
    tournees    = relationship("Tournee", back_populates="warehouse")
