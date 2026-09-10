import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("library_management")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Structured request log: method, path, role (once authenticated), status, latency."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        role = getattr(request.state, "role", "-")
        logger.info(
            "%s %s role=%s status=%s %.1fms",
            request.method,
            request.url.path,
            role,
            response.status_code,
            elapsed_ms,
        )
        return response
