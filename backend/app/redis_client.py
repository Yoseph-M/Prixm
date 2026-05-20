"""
Redis client + an in-memory fallback that mimics the subset of commands we use.

REDIS PATTERNS
==============
1. `renewals:zset`
   A SORTED SET where the member is the subscription `_id` (string) and the
   score is the next renewal time as a Unix epoch (seconds, float).
   The scheduler runs `ZRANGEBYSCORE renewals:zset now now+7d` once a minute.
   Sorted sets are O(log N) for insert and O(log N + M) for range scans, which
   makes "show me everything renewing in the next week" trivially cheap, even
   with millions of subscriptions.

2. `alert:sent:{sub_id}:{window_days}`
   A simple string key with a TTL equal to the window. Acts as an idempotency
   guard so we don't spam the same 7-day alert every minute.

3. `fx:rates`
   Cached JSON blob of FX rates with a 12h TTL. `SET ... EX 43200`.

4. `dashboard:totals`
   Cached aggregation result, invalidated on every write to subscriptions.
"""
from __future__ import annotations
import json
import time
from typing import Any
from sortedcontainers import SortedList
from .config import settings

try:
    import redis.asyncio as aioredis
except Exception:  # pragma: no cover
    aioredis = None  # type: ignore


class InMemoryRedis:
    """Tiny subset of redis.asyncio commands, enough for this prototype."""

    def __init__(self) -> None:
        # ZSET: name -> SortedList[(score, member)]
        self._zsets: dict[str, SortedList] = {}
        # KV: name -> (value, expires_at_epoch | None)
        self._kv: dict[str, tuple[str, float | None]] = {}

    async def zadd(self, key: str, mapping: dict[str, float]) -> int:
        zs = self._zsets.setdefault(key, SortedList(key=lambda x: x[0]))
        # Remove existing entries for the same members.
        existing = [item for item in zs if item[1] in mapping]
        for item in existing:
            zs.remove(item)
        for member, score in mapping.items():
            zs.add((float(score), member))
        return len(mapping)

    async def zrem(self, key: str, *members: str) -> int:
        zs = self._zsets.get(key)
        if not zs:
            return 0
        removed = 0
        for item in list(zs):
            if item[1] in members:
                zs.remove(item)
                removed += 1
        return removed

    async def zrangebyscore(self, key: str, min_score: float, max_score: float) -> list[str]:
        zs = self._zsets.get(key)
        if not zs:
            return []
        return [m for s, m in zs if min_score <= s <= max_score]

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        expires = (time.time() + ex) if ex else None
        self._kv[key] = (value, expires)
        return True

    async def get(self, key: str) -> str | None:
        item = self._kv.get(key)
        if not item:
            return None
        value, expires = item
        if expires and time.time() > expires:
            self._kv.pop(key, None)
            return None
        return value

    async def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            if k in self._kv:
                self._kv.pop(k, None)
                n += 1
        return n

    async def exists(self, key: str) -> int:
        return 1 if await self.get(key) is not None else 0

    async def aclose(self) -> None:  # parity with redis.asyncio
        return None


_client: Any | None = None


def get_redis():
    """Return either a real Redis client or the in-memory fallback."""
    global _client
    if _client is not None:
        return _client
    if settings.REDIS_URL and aioredis is not None:
        _client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    else:
        _client = InMemoryRedis()
    return _client


# Convenience JSON helpers
async def jset(key: str, value: Any, ex: int | None = None) -> None:
    await get_redis().set(key, json.dumps(value, default=str), ex=ex)


async def jget(key: str) -> Any | None:
    raw = await get_redis().get(key)
    return json.loads(raw) if raw else None
