from sqlalchemy import Column, Integer, String, Float, Date, Time, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.enums import StatutCommandeEnum

class Commande(Base):
    __tablename__ = "commandes"

    id                  = Column(Integer, primary_key=True, index=True)
    expediteur_id       = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    adresse_enlevement  = Column(String, nullable=False)
    adresse_livraison   = Column(String, nullable=False)
    lat_enlevement      = Column(Float, nullable=False)
    lon_enlevement      = Column(Float, nullable=False)
    lat_livraison       = Column(Float, nullable=False)
    lon_livraison       = Column(Float, nullable=False)
    poids               = Column(Float, nullable=False)
    volume              = Column(Float, nullable=False)
    date_livraison      = Column(Date, nullable=False)
    heure_ouverture     = Column(Time, nullable=False)
    heure_fermeture     = Column(Time, nullable=False)
    statut              = Column(SAEnum(StatutCommandeEnum), default=StatutCommandeEnum.EN_ATTENTE)
    vehicule_id         = Column(Integer, ForeignKey("vehicules.id"), nullable=True)
    chauffeur_id        = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    expediteur = relationship("Utilisateur", foreign_keys=[expediteur_id], back_populates="commandes_crees")
    vehicule   = relationship("Vehicule", back_populates="commandes")
    chauffeur  = relationship("Utilisateur", foreign_keys=[chauffeur_id])
    stops      = relationship("StopTournee", back_populates="commande")