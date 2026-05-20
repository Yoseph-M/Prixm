"""
Renewal alert scheduler.

Every 60s we scan the `renewals:zset` for subscriptions whose next_renewal
falls inside any configured alert window (default 7 and 3 days). For each
match we emit an alert into `alerts:feed` (a capped list) and set a sentinel
`alert:sent:{id}:{window}` so we don't fire the same alert twice.
"""
from __future__ import annotations
import asyncio
import json
import time
from datetime import datetime
from .config import settings
from .redis_client import get_redis
from .db import get_db

ZSET = "renewals:zset"
FEED_KEY = "alerts:feed"  # JSON list, newest first, capped at 100


async def schedule_renewal(sub_id: str, next_renewal: datetime) -> None:
    """Insert/update a subscription in the renewal sorted set."""
    await get_redis().zadd(ZSET, {sub_id: next_renewal.timestamp()})


async def unschedule_renewal(sub_id: str) -> None:
    await get_redis().zrem(ZSET, sub_id)


async def get_alerts_feed() -> list[dict]:
    r = get_redis()
    raw = await r.get(FEED_KEY)
    return json.loads(raw) if raw else []


async def _push_alert(alert: dict) -> None:
    feed = await get_alerts_feed()
    feed.insert(0, alert)
    feed = feed[:100]
    await get_redis().set(FEED_KEY, json.dumps(feed, default=str))


async def _scan_once() -> None:
    r = get_redis()
    db = get_db()
    now = time.time()
    for window_days in settings.alert_windows:
        max_score = now + window_days * 86400
        # ZRANGEBYSCORE(now, now+window) — anything renewing inside this window.
        ids = await r.zrangebyscore(ZSET, now, max_score)
        for sub_id in ids:
            sentinel = f"alert:sent:{sub_id}:{window_days}"
            if await r.exists(sentinel):
                continue
            sub = await db.subscriptions.find_one({"_id": sub_id})
            if not sub:
                await r.zrem(ZSET, sub_id)
                continue
            alert = {
                "subscription_id": sub_id,
                "user_id": sub.get("user_id"),
                "name": sub.get("name"),
                "window_days": window_days,
                "next_renewal": sub.get("next_renewal"),
                "amount_usd": sub.get("cost_usd"),
                "fired_at": datetime.utcnow(),
            }
            await _push_alert(alert)
            # TTL = window length so the sentinel auto-expires after the event.
            await r.set(sentinel, "1", ex=window_days * 86400)


async def scheduler_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await _scan_once()
        except Exception as e:  # never let the loop die
            print(f"[scheduler] error: {e}")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=60)
        except asyncio.TimeoutError:
            pass
