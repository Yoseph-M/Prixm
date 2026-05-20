"""Hourly renewal alert scan — used by APScheduler."""
from __future__ import annotations

import logging
import time
from datetime import datetime

from ..db import get_db
from ..redis_client import get_redis
from ..scheduler import FEED_KEY, ZSET, _push_alert

logger = logging.getLogger("prixm.alerts")
ALERT_SENT_TTL = 86400  # 24 hours
SCAN_WINDOW_DAYS = 7


async def run_renewal_alert_scan() -> int:
    """
    ZRANGEBYSCORE renewals:zset 0 (now + 7 days).
    For each sub, skip if alert:sent:{sub_id} exists; else log alert and set 24h TTL.
    Returns count of alerts fired.
    """
    r = get_redis()
    db = get_db()
    now = time.time()
    max_score = now + SCAN_WINDOW_DAYS * 86400
    ids = await r.zrangebyscore(ZSET, 0, max_score)
    fired = 0

    for sub_id in ids:
        sentinel = f"alert:sent:{sub_id}"
        if await r.exists(sentinel):
            continue

        sub = await db.subscriptions.find_one(
            {"_id": sub_id, "deleted_at": {"$exists": False}, "status": "active"}
        )
        if not sub:
            await r.zrem(ZSET, sub_id)
            continue

        renewal_ts = sub.get("next_renewal")
        if hasattr(renewal_ts, "timestamp"):
            days_left = max(0, int((renewal_ts.timestamp() - now) / 86400))
        else:
            days_left = 0

        alert = {
            "subscription_id": sub_id,
            "user_id": sub.get("user_id"),
            "name": sub.get("name"),
            "window_days": days_left,
            "next_renewal": renewal_ts,
            "amount_usd": sub.get("cost_usd"),
            "fired_at": datetime.utcnow(),
        }
        await _push_alert(alert)
        await r.set(sentinel, "1", ex=ALERT_SENT_TTL)
        logger.info(
            "renewal_alert sub_id=%s user_id=%s days_left=%s",
            sub_id,
            sub.get("user_id"),
            days_left,
        )
        fired += 1

    return fired
