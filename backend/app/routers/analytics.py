"""Analytics endpoint — cached aggregation results."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..firebase_auth import get_current_user
from ..services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("")
async def analytics(user: dict = Depends(get_current_user)):
    return await analytics_service.get_analytics(user["uid"])
