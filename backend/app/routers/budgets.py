"""Budget caps router — scoped to the authenticated user."""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..firebase_auth import get_current_user
from ..models import BudgetIn
from ..services.cache_service import invalidate_user_caches

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _serialize(doc: dict) -> dict:
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    return out


@router.get("")
async def list_budgets(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.budgets.find({"user_id": user["uid"]})
    return [_serialize(b) async for b in cursor]


@router.post("", status_code=201)
async def create_or_update_budget(payload: BudgetIn, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow()
    existing = await db.budgets.find_one({"user_id": user["uid"], "category": payload.category.lower()})
    
    if existing:
        res = await db.budgets.find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": {"monthly_limit_usd": payload.monthly_limit_usd, "updated_at": now}},
            return_document=True,
        )
        await invalidate_user_caches(user["uid"])
        return _serialize(res)

    budget_id = str(uuid.uuid4())
    doc = {
        "_id": budget_id,
        "user_id": user["uid"],
        "category": payload.category.lower(),
        "monthly_limit_usd": payload.monthly_limit_usd,
        "created_at": now,
        "updated_at": now,
    }
    await db.budgets.insert_one(doc)
    await invalidate_user_caches(user["uid"])
    return _serialize(doc)


@router.delete("/{category}", status_code=204)
async def delete_budget(category: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.budgets.delete_one({"user_id": user["uid"], "category": category.lower()})
    if res.deleted_count == 0:
        raise HTTPException(404, "Budget not found")
    await invalidate_user_caches(user["uid"])
