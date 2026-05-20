"""Spending dashboard aggregations — scoped to the authenticated user."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from ..db import get_db
from ..firebase_auth import get_current_user
from ..redis_client import get_redis
from ..services.cache_service import dashboard_cache_key
from ..services.subscription_service import NOT_DELETED

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/totals")
async def totals(user: dict = Depends(get_current_user)):
    uid = user["uid"]
    cache_key = dashboard_cache_key(uid)

    r = get_redis()
    cached = await r.get(cache_key)
    if cached:
        return json.loads(cached)

    db = get_db()
    pipeline = [
        {"$match": {"status": "active", "user_id": uid, **NOT_DELETED}},
        {
            "$addFields": {
                "monthly_usd": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$billing_cycle", "monthly"]}, "then": "$cost_usd"},
                            {
                                "case": {"$eq": ["$billing_cycle", "yearly"]},
                                "then": {"$divide": ["$cost_usd", 12]},
                            },
                            {
                                "case": {"$eq": ["$billing_cycle", "weekly"]},
                                "then": {"$multiply": ["$cost_usd", 4.345]},
                            },
                        ],
                        "default": "$cost_usd",
                    }
                }
            }
        },
        {
            "$group": {
                "_id": "$category",
                "monthly_usd": {"$sum": "$monthly_usd"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"monthly_usd": -1}},
    ]
    by_cat = [
        {"category": d["_id"], "monthly_usd": round(d["monthly_usd"], 2), "count": d["count"]}
        async for d in db.subscriptions.aggregate(pipeline)
    ]
    monthly_total = round(sum(c["monthly_usd"] for c in by_cat), 2)
    yearly_total = round(monthly_total * 12, 2)
    active = await db.subscriptions.count_documents(
        {"status": "active", "user_id": uid, **NOT_DELETED}
    )
    cancelled = await db.subscriptions.count_documents(
        {"status": "cancelled", "user_id": uid, **NOT_DELETED}
    )

    result = {
        "monthly_total_usd": monthly_total,
        "yearly_total_usd": yearly_total,
        "active_count": active,
        "cancelled_count": cancelled,
        "by_category": by_cat,
    }
    await r.set(cache_key, json.dumps(result, default=str), ex=30)
    return result
