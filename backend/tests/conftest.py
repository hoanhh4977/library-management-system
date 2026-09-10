import asyncio
import os
import subprocess
import sys
import uuid
from datetime import date
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:55432/lms_test")
os.environ.setdefault("SUPABASE_JWKS_URL", "https://example.invalid/jwks")

# asyncpg + the default Windows ProactorEventLoop raise spurious
# "Event loop is closed" / AttributeError noise while tearing down connections.
# The Selector policy doesn't have this issue and is what asyncpg recommends on Windows.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import SessionLocal, engine
from src.core.deps import get_auth_claims, get_current_profile
from src.main import app
from src.models.profile import Profile

BACKEND_DIR = Path(__file__).resolve().parent.parent

ALL_TABLES = [
    "loan_request_items",
    "loan_requests",
    "card_unlock_requests",
    "loan_details",
    "loans",
    "library_cards",
    "books",
    "profiles",
]


@pytest.fixture(scope="session", autouse=True)
def _migrated_schema():
    """Apply the real Alembic migration once per test session, in a subprocess
    (keeps the async engine used by migrations out of pytest-asyncio's loop)."""
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=os.environ.copy(),
        check=True,
    )
    yield


@pytest.fixture(autouse=True)
async def _clean_tables():
    yield
    async with SessionLocal() as s:
        await s.execute(text(f"TRUNCATE TABLE {', '.join(ALL_TABLES)} CASCADE"))
        await s.commit()


@pytest.fixture(scope="session", autouse=True)
async def _dispose_engine_before_loop_closes():
    """Explicitly close all pooled connections while the session-scoped loop is
    still alive — otherwise SQLAlchemy's pool finalizes them after the loop is
    already gone, which asyncpg reports as noisy (but harmless) teardown errors."""
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def session() -> AsyncSession:
    async with SessionLocal() as s:
        yield s


async def _create_profile(session: AsyncSession, role: str, **overrides) -> Profile:
    defaults = dict(
        id=uuid.uuid4(),
        role=role,
        code=f"{role[:2].upper()}{uuid.uuid4().hex[:6]}",
        full_name="Người dùng thử nghiệm",
        date_of_birth=date(1995, 1, 1),
        email=f"{uuid.uuid4().hex}@example.com",
    )
    defaults.update(overrides)
    profile = Profile(**defaults)
    session.add(profile)
    await session.commit()
    return profile


@pytest.fixture
def make_profile(session: AsyncSession):
    async def _factory(role: str, **overrides) -> Profile:
        return await _create_profile(session, role, **overrides)

    return _factory


@pytest.fixture
def client_as():
    """client_as(profile) -> AsyncClient authenticated as that profile.

    Bypasses real Supabase JWT verification entirely by overriding the
    get_current_profile dependency — tests exercise our own authorization
    logic (require_role), not Supabase's token issuance.
    """

    def _factory(profile: Profile) -> AsyncClient:
        app.dependency_overrides[get_current_profile] = lambda: profile
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    return _factory


@pytest.fixture
def client_with_claims():
    """client_with_claims(sub=..., email=..., email_confirmed_at=...) -> AsyncClient
    with get_auth_claims overridden — for endpoints that run before a `profiles`
    row exists (e.g. POST /api/auth/complete-registration)."""

    def _factory(**claims) -> AsyncClient:
        claims.setdefault("email_confirmed_at", "2026-01-01T00:00:00Z")
        app.dependency_overrides[get_auth_claims] = lambda: claims
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    return _factory


@pytest.fixture
async def anon_client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
