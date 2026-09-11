from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import get_settings

settings = get_settings()

# statement_cache_size=0: required when DATABASE_URL points at Supabase's transaction-mode
# PgBouncer pooler (port 6543) — pooled connections are reused across different backend
# sessions, so asyncpg's prepared-statement cache can point at a statement the current
# physical connection never actually prepared, raising "prepared statement ... does not exist".
#
# pool_pre_ping is off: it would add a round-trip "SELECT 1" health check on every
# checkout, which against a remote pooler roughly doubles per-request DB latency.
# PgBouncer connections here are short-lived enough that staleness isn't a real risk.
engine = create_async_engine(
    settings.sqlalchemy_database_url,
    connect_args={"statement_cache_size": 0},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
