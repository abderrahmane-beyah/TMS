from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.enums import RoleEnum, StatutChauffeurEnum

class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id            = Column(Integer, primary_key=True, index=True)
    nom           = Column(String, nullable=False)
    email         = Column(String, unique=True, nullable=False, index=True)
    mot_de_passe  = Column(String, nullable=False)
    telephone     = Column(String, nullable=True)
    role          = Column(SAEnum(RoleEnum), nullable=False)
    ville         = Column(String, nullable=True)  
    warehouse_id  = Column(Integer, ForeignKey("warehouses.id"), nullable=True)  
    actif         = Column(Boolean, default=True)
    statut        = Column(SAEnum(StatutChauffeurEnum), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    warehouse           = relationship("Warehouse", foreign_keys=[warehouse_id], back_populates="chauffeurs")
    commandes_crees     = relationship("Commande", foreign_keys="Commande.expediteur_id", back_populates="expediteur")
    tournees_effectuees = relationship("Tournee", foreign_keys="Tournee.chauffeur_id", back_populates="chauffeur")