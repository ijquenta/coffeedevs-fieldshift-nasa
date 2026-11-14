from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    power_base_url: str = "https://power.larc.nasa.gov"
    power_timeout_s: float = 60.0
    power_max_retries: int = 3
    power_max_concurrency: int = 4
    power_max_params_per_request: int = 15
    power_max_points: int = 25
    power_cache_ttl_s: int = 3600
    power_user: str | None = None
    cors_origins: list[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
