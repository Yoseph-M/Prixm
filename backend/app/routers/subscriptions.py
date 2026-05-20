"""Subscription routes — delegate to subscription_service."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..firebase_auth import get_current_user
from ..models import CancelIn, StatusPatch, SubscriptionIn
from ..services import subscription_service as svc

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("")
async def list_subs(
    q: str | None = Query(None, description="Search across name/vendor/tags"),
    tag: str | None = None,
    status: str | None = None,
    category: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    return await svc.get_all(
        user["uid"],
        q=q,
        tag=tag,
        status=status,
        category=category,
        page=page,
        limit=limit,
    )


@router.post("", status_code=201)
async def create_sub(payload: SubscriptionIn, user: dict = Depends(get_current_user)):
    return await svc.create(user["uid"], payload)


@router.get("/{sub_id}")
async def get_sub(sub_id: str, user: dict = Depends(get_current_user)):
    return await svc.get_by_id(user["uid"], sub_id)


@router.put("/{sub_id}")
async def update_sub(sub_id: str, payload: SubscriptionIn, user: dict = Depends(get_current_user)):
    return await svc.update(user["uid"], sub_id, payload)


@router.patch("/{sub_id}/status")
async def patch_status(
    sub_id: str, payload: StatusPatch, user: dict = Depends(get_current_user)
):
    return await svc.patch_status(user["uid"], sub_id, payload)


@router.delete("/{sub_id}", status_code=204)
async def delete_sub(sub_id: str, user: dict = Depends(get_current_user)):
    await svc.soft_delete(user["uid"], sub_id)


@router.post("/{sub_id}/cancel")
async def cancel_sub(sub_id: str, payload: CancelIn, user: dict = Depends(get_current_user)):
    return await svc.cancel(user["uid"], sub_id, payload)
