from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.enums import TypeAnomalieEnum, StatutAnomalieEnum

class Anomalie(Base):
    __tablename__ = "anomalies"

    id                = Column(Integer, primary_key=True, index=True)
    tournee_id        = Column(Integer, ForeignKey("tournees.id"), nullable=False)
    stop_id           = Column(Integer, ForeignKey("stops_tournee.id"), nullable=True)
    type              = Column(SAEnum(TypeAnomalieEnum), nullable=False)
    description       = Column(String, nullable=False)
    date_signalement  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    statut            = Column(SAEnum(StatutAnomalieEnum), default=StatutAnomalieEnum.OUVERTE)

    # Relationships
    tournee = relationship("Tournee", back_populates="anomalies")
    stop    = relationship("StopTournee", back_populates="anomalies")