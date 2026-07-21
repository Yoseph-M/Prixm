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

import uuid
from ..scheduler import _push_alert

router = APIRouter(tags=["payments"])


@router.get("/payments")
async def list_all_user_payments(user: dict = Depends(get_current_user)):
    cursor = get_db().subscriptions.find(
        {"user_id": user["uid"], **NOT_DELETED},
        {"name": 1, "vendor": 1, "category": 1, "cost_usd": 1, "payments": 1},
    )
    all_payments = []
    async for sub in cursor:
        sub_id = str(sub["_id"])
        sub_name = sub.get("name", "")
        sub_vendor = sub.get("vendor", "")
        sub_category = sub.get("category", "other")
        sub_cost_usd = sub.get("cost_usd", 0.0)
        payments_list = sub.get("payments", [])
        for idx, p in enumerate(payments_list):
            pay_dict = dict(p)
            if "id" not in pay_dict or not pay_dict["id"]:
                pay_dict["id"] = f"{sub_id}_p{idx}"
            pay_dict["sub_id"] = sub_id
            pay_dict["name"] = sub_name
            pay_dict["vendor"] = sub_vendor
            pay_dict["category"] = sub_category
            pay_dict["status"] = pay_dict.get("status", "paid")
            if "cost_usd" not in pay_dict:
                pay_dict["cost_usd"] = pay_dict.get("amount_usd", sub_cost_usd)
            all_payments.append(pay_dict)

    all_payments.sort(key=lambda x: str(x.get("date") or ""), reverse=True)
    return all_payments


@router.get("/subscriptions/{sub_id}/payments")
async def list_payments(sub_id: str, user: dict = Depends(get_current_user)):
    doc = await get_db().subscriptions.find_one(
        {"_id": sub_id, "user_id": user["uid"], **NOT_DELETED}, {"payments": 1}
    )
    if not doc:
        raise HTTPException(404, "Not found")
    return doc.get("payments", [])


@router.post("/subscriptions/{sub_id}/payments", status_code=201)
async def add_payment(sub_id: str, payload: PaymentIn, user: dict = Depends(get_current_user)):
    amount_usd = await to_usd(payload.amount, payload.currency)
    db = get_db()
    existing_sub = await db.subscriptions.find_one(
        {"_id": sub_id, "user_id": user["uid"], **NOT_DELETED}
    )
    if not existing_sub:
        raise HTTPException(404, "Not found")

    pay_id = str(uuid.uuid4())
    payment = {
        "id": pay_id,
        "date": payload.date or datetime.utcnow(),
        "amount": payload.amount,
        "currency": payload.currency,
        "amount_usd": amount_usd,
        "status": payload.status,
        "method": payload.method,
        "note": payload.note,
    }

    # Price hike detection
    existing_payments = existing_sub.get("payments", [])
    if existing_payments:
        last_payment = existing_payments[-1]
        prev_usd = last_payment.get("amount_usd", 0.0)
        if prev_usd > 0 and amount_usd > prev_usd * 1.10:
            pct_increase = round(((amount_usd - prev_usd) / prev_usd) * 100, 1)
            alert = {
                "subscription_id": sub_id,
                "user_id": user["uid"],
                "name": existing_sub.get("name"),
                "type": "price_hike",
                "message": f"Price hike detected for {existing_sub.get('name')}: +{pct_increase}% (from ${prev_usd:.2f} to ${amount_usd:.2f})",
                "amount_usd": amount_usd,
                "fired_at": datetime.utcnow(),
            }
            await _push_alert(alert)

    res = await db.subscriptions.find_one_and_update(
        {"_id": sub_id, "user_id": user["uid"], **NOT_DELETED},
        {"$push": {"payments": payment}, "$set": {"updated_at": datetime.utcnow()}},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Not found")
    await invalidate_user_caches(user["uid"])
    return payment
