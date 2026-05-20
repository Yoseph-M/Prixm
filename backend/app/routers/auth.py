"""
Auth sync endpoint.

POST /auth/sync is called by the frontend immediately after a successful
Firebase registration (or first Google sign-in).  It upserts a user
document in MongoDB so the backend has a local copy of the user profile.

WHY UPSERT=True?
----------------
The same endpoint handles both "first sign-up" and "returning user who
might not have a MongoDB document yet" (e.g. signed in via Google on a
new device before the original /auth/sync completed, or the frontend
retried after a network failure).  Upsert=True makes the operation
idempotent — calling it twice is harmless.
"""
from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends
from ..db import get_db
from ..firebase_auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync")
async def sync_user(user: dict = Depends(get_current_user)):
    """
    Upsert the authenticated user into the MongoDB `users` collection.
    The uid comes from the verified Firebase token — never from the body.
    """
    db = get_db()
    await db.users.update_one(
        {"firebase_uid": user["uid"]},
        {
            "$set": {
                "firebase_uid": user["uid"],
                "email": user.get("email"),
                "display_name": user.get("name"),
                "photo_url": user.get("picture"),
                "last_login": datetime.utcnow(),
            },
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
            },
        },
        upsert=True,  # See module docstring for rationale.
    )
    return {
        "status": "ok",
        "uid": user["uid"],
        "email": user.get("email"),
    }
