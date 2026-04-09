from sqlalchemy import Column, Integer, Float, DateTime, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.enums import AlgorithmeEnum, StatutTacheEnum

class TacheOptimisation(Base):
    __tablename__ = "taches_optimisation"

    id                      = Column(Integer, primary_key=True, index=True)
    algorithme              = Column(SAEnum(AlgorithmeEnum), nullable=False)
    statut                  = Column(SAEnum(StatutTacheEnum), default=StatutTacheEnum.EN_ATTENTE)
    progression             = Column(Integer, default=0)
    temps_execution         = Column(Float, nullable=True)
    distance_totale         = Column(Float, nullable=True)
    nb_vehicules_utilises   = Column(Integer, nullable=True)
    nb_commandes_non_servies= Column(Integer, nullable=True)
    date_execution          = Column(DateTime(timezone=True), nullable=True)
    resultat_json           = Column(JSON, nullable=True)
    created_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    tournees = relationship("Tournee", back_populates="tache")