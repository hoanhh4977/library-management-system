from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import auth, books, cards, librarians, loan_requests, loans, me, readers, reports
from src.core.config import get_settings
from src.core.logging import RequestLoggingMiddleware

settings = get_settings()

app = FastAPI(title="Library Management System API")

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me.router)
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(readers.router)
app.include_router(librarians.router)
app.include_router(loans.router)
app.include_router(loan_requests.router)
app.include_router(cards.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
