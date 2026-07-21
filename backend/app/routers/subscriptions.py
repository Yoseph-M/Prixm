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


from fastapi.responses import Response


@router.get("/calendar.ics")
async def get_calendar_ics(user: dict = Depends(get_current_user)):
    subs_data = await svc.get_all(user["uid"], status="active", limit=100)
    subs = subs_data.get("data", [])

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Prixm Subscription Manager//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Prixm Subscription Renewals",
    ]

    for sub in subs:
        sub_id = sub.get("id")
        name = sub.get("name", "Subscription")
        cost = sub.get("cost_usd", 0.0)
        category = sub.get("category", "")
        next_renewal = sub.get("next_renewal")

        dt = None
        if isinstance(next_renewal, str):
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(next_renewal.replace("Z", "+00:00"))
            except Exception:
                pass
        elif hasattr(next_renewal, "strftime"):
            dt = next_renewal

        if dt:
            dt_str = dt.strftime("%Y%m%dT%H%M%SZ")
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:renewal-{sub_id}@prixm.app",
                f"DTSTAMP:{dt_str}",
                f"DTSTART:{dt_str}",
                f"SUMMARY:Renewal: {name} (${cost:.2f})",
                f"DESCRIPTION:Subscription {name} in {category} renews today for ${cost:.2f}",
                "STATUS:CONFIRMED",
                "END:VEVENT",
            ])

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)
    return Response(content=ics_content, media_type="text/calendar")


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
