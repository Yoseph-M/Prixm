"""Subscription CRUD — all Mongo access for subscriptions lives here."""
from __future__ import annotations

import math
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException

from ..db import get_db
from ..fx import to_usd
from ..models import CancelIn, StatusPatch, SubscriptionIn
from ..scheduler import schedule_renewal, unschedule_renewal
from .cache_service import invalidate_user_caches

NOT_DELETED = {"deleted_at": {"$exists": False}}
DEFAULT_PAGE_SIZE = 20


from difflib import SequenceMatcher


def _serialize(doc: dict) -> dict:
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    if out.get("cancellation"):
        out["cancel_reason"] = out["cancellation"].get("reason")
        out["cancelled_at"] = out["cancellation"].get("date")
    return out


def _base_filter(user_id: str, extra: dict | None = None) -> dict:
    flt = {"user_id": user_id, **NOT_DELETED}
    if extra:
        flt.update(extra)
    return flt


async def get_all(
    user_id: str,
    *,
    q: str | None = None,
    tag: str | None = None,
    status: str | None = None,
    category: str | None = None,
    page: int = 1,
    limit: int = DEFAULT_PAGE_SIZE,
) -> dict[str, Any]:
    db = get_db()
    flt = _base_filter(user_id)
    if q:
        flt["$text"] = {"$search": q}
    if tag:
        flt["tags"] = tag
    if status:
        flt["status"] = status
    if category:
        flt["category"] = category

    page = max(1, page)
    limit = max(1, min(limit, 100))
    skip = (page - 1) * limit

    total = await db.subscriptions.count_documents(flt)
    pages = max(1, math.ceil(total / limit)) if total else 1

    cursor = db.subscriptions.find(flt).sort("next_renewal", 1).skip(skip).limit(limit)
    data = [_serialize(d) async for d in cursor]
    return {"data": data, "total": total, "page": page, "pages": pages}


async def get_by_id(user_id: str, sub_id: str) -> dict:
    doc = await get_db().subscriptions.find_one(_base_filter(user_id, {"_id": sub_id}))
    if not doc:
        raise HTTPException(404, "Not found")
    return _serialize(doc)


async def create(user_id: str, payload: SubscriptionIn) -> dict:
    db = get_db()
    now = datetime.utcnow()
    sub_id = str(uuid.uuid4())
    cost_usd = await to_usd(payload.cost.amount, payload.cost.currency)

    # Duplicate-subscription detection
    existing_cursor = db.subscriptions.find(
        _base_filter(user_id, {"status": "active", "category": payload.category})
    )
    existing_subs = [d async for d in existing_cursor]
    warning_msg = None
    p_name = payload.name.strip().lower()
    p_vendor = (payload.vendor or "").strip().lower()

    for sub in existing_subs:
        s_name = sub.get("name", "").strip().lower()
        s_vendor = (sub.get("vendor") or "").strip().lower()

        name_sim = SequenceMatcher(None, p_name, s_name).ratio()
        vendor_sim = (
            SequenceMatcher(None, p_vendor, s_vendor).ratio() if p_vendor and s_vendor else 0
        )

        if name_sim >= 0.75 or (p_vendor and s_vendor and vendor_sim >= 0.75):
            warning_msg = f"Possible duplicate subscription found: '{sub.get('name')}' in category '{payload.category}'"
            break

    doc = {
        "_id": sub_id,
        "user_id": user_id,
        **payload.model_dump(),
        "cost_usd": cost_usd,
        "status": "active",
        "cancellation": None,
        "payments": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.subscriptions.insert_one(doc)
    await schedule_renewal(sub_id, payload.next_renewal)
    await invalidate_user_caches(user_id)
    serialized = _serialize(doc)
    if warning_msg:
        serialized["warning"] = warning_msg
    return serialized


async def update(user_id: str, sub_id: str, payload: SubscriptionIn) -> dict:
    db = get_db()
    cost_usd = await to_usd(payload.cost.amount, payload.cost.currency)
    update_doc = {
        **payload.model_dump(),
        "cost_usd": cost_usd,
        "updated_at": datetime.utcnow(),
    }
    res = await db.subscriptions.find_one_and_update(
        _base_filter(user_id, {"_id": sub_id}),
        {"$set": update_doc},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Not found")
    if res.get("status") == "active":
        await schedule_renewal(sub_id, payload.next_renewal)
    await invalidate_user_caches(user_id)
    return _serialize(res)


async def patch_status(user_id: str, sub_id: str, payload: StatusPatch) -> dict:
    db = get_db()
    now = datetime.utcnow()
    extra: dict[str, Any] = {"status": payload.status, "updated_at": now}
    if payload.status == "cancelled":
        extra["cancellation"] = {"date": now, "reason": "Status changed to cancelled"}

    res = await db.subscriptions.find_one_and_update(
        _base_filter(user_id, {"_id": sub_id}),
        {"$set": extra},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Not found")

    if payload.status == "active":
        await schedule_renewal(sub_id, res["next_renewal"])
    else:
        await unschedule_renewal(sub_id)

    await invalidate_user_caches(user_id)
    return _serialize(res)


async def soft_delete(user_id: str, sub_id: str) -> None:
    now = datetime.utcnow()
    res = await get_db().subscriptions.update_one(
        _base_filter(user_id, {"_id": sub_id}),
        {"$set": {"deleted_at": now, "updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    await unschedule_renewal(sub_id)
    await invalidate_user_caches(user_id)


async def cancel(user_id: str, sub_id: str, payload: CancelIn) -> dict:
    db = get_db()
    cancellation = {"date": payload.date or datetime.utcnow(), "reason": payload.reason}
    res = await db.subscriptions.find_one_and_update(
        _base_filter(user_id, {"_id": sub_id}),
        {
            "$set": {
                "status": "cancelled",
                "cancellation": cancellation,
                "updated_at": datetime.utcnow(),
            }
        },
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Not found")
    await unschedule_renewal(sub_id)
    await invalidate_user_caches(user_id)
    return _serialize(res)
