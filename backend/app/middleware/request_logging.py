"""Structured request logging with uid, path, and latency."""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("prixm.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        uid = "anonymous"
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            uid = "authenticated"

        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "uid=%s method=%s path=%s status=%s duration_ms=%.1f",
            uid,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
