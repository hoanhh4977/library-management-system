import uuid
from datetime import date, timedelta

from src.models.loan import Loan


async def _seed_loan(session, reader, librarian, *, due_date, renewed=False):
    loan = Loan(
        id=uuid.uuid4(), code=f"PM{uuid.uuid4().hex[:8].upper()}", reader_id=reader.id,
        librarian_id=librarian.id, loan_date=date.today(), due_date=due_date, renewed=renewed,
    )
    session.add(loan)
    await session.commit()
    return loan


async def test_renew_endpoint_happy_path(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = await _seed_loan(session, reader, librarian, due_date=date.today() + timedelta(days=3))

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/renew")

    assert response.status_code == 200
    assert response.json()["renewed"] is True


async def test_renew_endpoint_conflict_when_already_renewed(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = await _seed_loan(session, reader, librarian, due_date=date.today() + timedelta(days=3), renewed=True)

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/renew")

    assert response.status_code == 409
