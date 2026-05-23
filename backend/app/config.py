
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"

    # Routing service configuration
    ROUTING_BACKEND: str = "osrm"  # 'osrm'
    OSRM_URL: str = "http://router.project-osrm.org"  # serveur OSRM public ou localhost:5000
    GOOGLE_MAPS_API_KEY: str = ""  # Optional: pour Google Maps Distance Matrix

    # Depot configuration
    DEPOT_OPEN_HOUR: int = 6   # Depot ouvre 6:00 AM
    DEPOT_CLOSE_HOUR: int = 20  # Depot ferme 8:00 PM (20:00)
    DEPOT_LAT: float = 18.0735  # Nouakchott default depot latitude
    DEPOT_LON: float = -15.9582  # Nouakchott default depot longitude
    DEPOT_LOAD_MINUTES: int = 60  # temps de chargement/rechargement au dépôt (delta)
    SOFT_WINDOW_GRACE_MINUTES: int = 120  # période de grâce g pour les fenêtres souples

    # Docker postgres vars 
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "tms_db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()