from functools import lru_cache

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from src.core.config import get_settings


@lru_cache
def _jwk_client() -> PyJWKClient:
    settings = get_settings()
    # PyJWKClient's default 30s network timeout means a single flaky connection
    # attempt to Supabase can stall an entire request for 30+ seconds before
    # failing — cut it to 5s so auth fails fast instead of hanging the request.
    return PyJWKClient(settings.supabase_jwks_url, timeout=5)


def decode_supabase_jwt(token: str) -> dict:
    """Verify a Supabase-issued access token against its published JWKS.

    Raises HTTPException(401) on any signature/expiry/format failure so callers
    can just `dependency = decode_supabase_jwt` without repeating error handling.
    """
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
        ) from exc
    return payload
