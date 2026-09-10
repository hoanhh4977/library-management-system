# Library Management System — Backend

FastAPI service for the Library Management System. See `../specs/001-library-management/` for the full spec/plan/data-model.

## Setup

```bash
conda activate library-management   # Python 3.11 env (already created)
pip install -e ".[dev]"
cp .env.example .env                # fill in SUPABASE_* + DATABASE_URL
alembic upgrade head
uvicorn src.main:app --reload --port 8000
```

`DATABASE_URL` must point at the Supabase project's Postgres (Project Settings → Database), e.g.
`postgresql+asyncpg://postgres:<password>@<host>:5432/postgres`.

## Tests

Tests run against a real disposable Postgres (not Supabase) — spin one up once:

```bash
docker run -d --name lms-test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lms_test -p 55432:5432 postgres:16-alpine
```

Then:

```bash
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:55432/lms_test" \
SUPABASE_JWKS_URL="https://example.invalid/jwks" \
pytest
```

(`conftest.py` applies the Alembic migration to that DB automatically at the start of the session and truncates tables between tests — it never touches the real Supabase database.)

## Structure

See `specs/001-library-management/plan.md` → Project Structure for the full layout rationale.
`src/api/` (routes) → `src/services/` (business rules) → `src/models/` (SQLAlchemy) → `src/migrations/` (Alembic).
