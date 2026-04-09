from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.enums import StatutTourneeEnum, StatutStopEnum

class Tournee(Base):
    __tablename__ = "tournees"

    id                      = Column(Integer, primary_key=True, index=True)
    date                    = Column(Date, nullable=False)
    distance_totale         = Column(Float, nullable=True)
    progression             = Column(Integer, default=0)
    statut                  = Column(SAEnum(StatutTourneeEnum), default=StatutTourneeEnum.PLANIFIEE)
    heure_depart            = Column(DateTime(timezone=True), nullable=True)
    vehicule_id             = Column(Integer, ForeignKey("vehicules.id"), nullable=False)
    chauffeur_id            = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    tache_optimisation_id   = Column(Integer, ForeignKey("taches_optimisation.id"), nullable=True)
    created_at              = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    vehicule        = relationship("Vehicule", back_populates="tournees")
    chauffeur       = relationship("Utilisateur", foreign_keys=[chauffeur_id], back_populates="tournees_effectuees")
    stops           = relationship("StopTournee", back_populates="tournee", order_by="StopTournee.ordre")
    anomalies       = relationship("Anomalie", back_populates="tournee")
    tache           = relationship("TacheOptimisation", back_populates="tournees")


class StopTournee(Base):
    __tablename__ = "stops_tournee"

    id                  = Column(Integer, primary_key=True, index=True)
    tournee_id          = Column(Integer, ForeignKey("tournees.id"), nullable=False)
    commande_id         = Column(Integer, ForeignKey("commandes.id"), nullable=False)
    adresse             = Column(String, nullable=False)
    lat                 = Column(Float, nullable=False)
    lon                 = Column(Float, nullable=False)
    ordre               = Column(Integer, nullable=False)
    heure_arrivee_prevue  = Column(DateTime(timezone=True), nullable=True)
    heure_arrivee_reelle  = Column(DateTime(timezone=True), nullable=True)
    statut              = Column(SAEnum(StatutStopEnum), default=StatutStopEnum.EN_ATTENTE)

    # Relationships
    tournee   = relationship("Tournee", back_populates="stops")
    commande  = relationship("Commande", back_populates="stops")
    anomalies = relationship("Anomalie", back_populates="stop")