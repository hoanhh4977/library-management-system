import uuid
from datetime import datetime

from pydantic import BaseModel


class UnlockRequestOut(BaseModel):
    id: uuid.UUID
    card_id: uuid.UUID
    card_code: str
    reader_id: uuid.UUID
    reader_name: str
    requested_by: uuid.UUID
    requested_by_name: str
    requested_at: datetime
    status: str
