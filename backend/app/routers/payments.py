"""Payment history endpoints. Payments are EMBEDDED in the parent subscription.

All queries are scoped to the authenticated user's uid extracted from the
verified Firebase token — never from the request body.
"""
from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from ..db import get_db
from ..fx import to_usd
from ..models import PaymentIn
from ..firebase_auth import get_current_user
from ..services.cache_service import invalidate_user_caches
from ..services.subscription_service import NOT_DELETED

router = APIRouter(prefix="/subscriptions/{sub_id}/payments", tags=["payments"])


@router.get("")
async def list_payments(sub_id: str, user: dict = Depends(get_current_user)):
    doc = await get_db().subscriptions.find_one(
        {"_id": sub_id, "user_id": user["uid"], **NOT_DELETED}, {"payments": 1}
    )
    if not doc:
        raise HTTPException(404, "Not found")
    return doc.get("payments", [])


@router.post("", status_code=201)
async def add_payment(sub_id: str, payload: PaymentIn, user: dict = Depends(get_current_user)):
    amount_usd = await to_usd(payload.amount, payload.currency)
    payment = {
        "date": payload.date or datetime.utcnow(),
        "amount": payload.amount,
        "currency": payload.currency,
        "amount_usd": amount_usd,
        "method": payload.method,
        "note": payload.note,
    }
    # $push is atomic; no read-modify-write race even under concurrent clients.
    # Filter includes user_id to prevent writing to another user's subscription.
    res = await get_db().subscriptions.find_one_and_update(
        {"_id": sub_id, "user_id": user["uid"], **NOT_DELETED},
        {"$push": {"payments": payment}, "$set": {"updated_at": datetime.utcnow()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Not found")
    await invalidate_user_caches(user["uid"])
    return payment
