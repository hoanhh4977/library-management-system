from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

# backend/src/core/config.py -> repo root is 3 levels up from this file's directory.
_REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    # Repo-root .env (SUPABASE_*, DATABASE_URL) loads first; backend/.env (if present)
    # is read after and wins on any overlapping key.
    model_config = SettingsConfigDict(env_file=(_REPO_ROOT_ENV, ".env"), extra="ignore")

    database_url: str
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_jwks_url: str
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        """Normalize a raw Postgres URL (as copied from Supabase's dashboard, which may be
        `postgresql://...?pgbouncer=true`) into what SQLAlchemy's asyncpg driver accepts:
        the `+asyncpg` driver suffix, and no query params (asyncpg's connect() rejects
        unknown ones like `pgbouncer`, which is a Prisma-specific hint, not a real libpq param).
        """
        url = make_url(self.database_url)
        if url.drivername in ("postgresql", "postgres"):
            url = url.set(drivername="postgresql+asyncpg")
        return url.set(query={}).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
