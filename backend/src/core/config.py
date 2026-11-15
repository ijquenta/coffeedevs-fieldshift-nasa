from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración centralizada de la aplicación."""

    PROJECT_NAME: str = "FieldShift - API Copiloto Agronómico"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_TEMPERATURE: float = 0.3

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    power_base_url: str = "https://power.larc.nasa.gov"
    power_timeout_s: float = 30.0
    power_max_retries: int = 3
    power_max_concurrency: int = 8
    power_cache_ttl_s: int = 900
    power_max_params_per_request: int = 20
    power_max_points: int = 100
    power_user: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
