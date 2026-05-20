"""Redis cache invalidation for per-user aggregates."""
from __future__ import annotations

from ..redis_client import get_redis

ANALYTICS_TTL = 3600  # 1 hour


def analytics_cache_key(user_id: str) -> str:
    return f"cache:analytics:{user_id}"


def dashboard_cache_key(user_id: str) -> str:
    return f"dashboard:totals:{user_id}"


async def invalidate_user_caches(user_id: str) -> None:
    r = get_redis()
    await r.delete(analytics_cache_key(user_id), dashboard_cache_key(user_id))
