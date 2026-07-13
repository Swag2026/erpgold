from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/swag_gold"
    SECRET_KEY: str  # required — no insecure default; app will fail fast if unset
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"
    # Comma-separated list, e.g. "https://swag-gold.netlify.app,https://swaggroup.co"
    # Falls back to "*" only if left unset — set this in production.
    ALLOWED_ORIGINS: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        if self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    def model_post_init(self, __context):
        if len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long. Set it in your .env file.")

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
