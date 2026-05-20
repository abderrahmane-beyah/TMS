
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
    ROUTING_BACKEND: str = "osrm"  # 'osrm' or 'google' (haversine only as fallback)
    OSRM_URL: str = "http://router.project-osrm.org"  # Public OSRM server or localhost:5000
    GOOGLE_MAPS_API_KEY: str = ""  # Optional: for Google Maps Distance Matrix

    # Docker postgres vars — read but not used directly in app
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