"""Alerts feed (read from Redis) — scoped to the authenticated user."""
from fastapi import APIRouter, Depends
from ..scheduler import get_alerts_feed
from ..firebase_auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(user: dict = Depends(get_current_user)):
    # get_alerts_feed returns all alerts; we filter by the authenticated user.
    all_alerts = await get_alerts_feed()
    return [a for a in all_alerts if a.get("user_id") == user["uid"]]
