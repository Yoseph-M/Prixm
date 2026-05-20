"""Seed a small set of realistic subscriptions if the collection is empty.

NOTE: In production with Firebase auth, seeds require a valid user_id.
For the demo, we use a placeholder 'demo-user' uid. When a real user signs in,
their subscriptions are created fresh — the seed data is only for local/Docker
testing without Firebase configured.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from .db import get_db
from .fx import to_usd
from .scheduler import schedule_renewal

# Default demo user uid — used only when seeding for local testing.
DEMO_USER_ID = "demo-user"


def _days(n: int) -> datetime:
    return datetime.utcnow() + timedelta(days=n)


SAMPLE = [
    # Two land inside the alert windows on purpose so the demo lights up.
    {"name": "Netflix",   "vendor": "Netflix Inc.", "category": "entertainment",
     "tags": ["streaming", "video"], "cost": {"amount": 15.49, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 2},
    {"name": "Spotify",   "vendor": "Spotify AB", "category": "entertainment",
     "tags": ["streaming", "music"], "cost": {"amount": 10.99, "currency": "EUR"},
     "billing_cycle": "monthly", "next_renewal_in": 6},
    {"name": "AWS",       "vendor": "Amazon Web Services", "category": "cloud",
     "tags": ["work", "infra"], "cost": {"amount": 84.20, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 12},
    {"name": "Notion",    "vendor": "Notion Labs", "category": "productivity",
     "tags": ["work", "notes"], "cost": {"amount": 8.00, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 21},
    {"name": "NYT",       "vendor": "The New York Times", "category": "news",
     "tags": ["reading"], "cost": {"amount": 4.00, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 18},
    {"name": "iCloud+",   "vendor": "Apple", "category": "cloud",
     "tags": ["storage"], "cost": {"amount": 2.99, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 9},
    {"name": "Figma",     "vendor": "Figma Inc.", "category": "productivity",
     "tags": ["work", "design"], "cost": {"amount": 144.00, "currency": "USD"},
     "billing_cycle": "yearly", "next_renewal_in": 60},
    {"name": "ChatGPT",   "vendor": "OpenAI", "category": "productivity",
     "tags": ["work", "ai"], "cost": {"amount": 20.00, "currency": "USD"},
     "billing_cycle": "monthly", "next_renewal_in": 4},
]


async def seed_if_empty() -> None:
    db = get_db()
    if await db.subscriptions.count_documents({}) > 0:
        return
    now = datetime.utcnow()
    for s in SAMPLE:
        sub_id = str(uuid.uuid4())
        next_renewal = _days(s["next_renewal_in"])
        cost_usd = await to_usd(s["cost"]["amount"], s["cost"]["currency"])
        # Synthesize a couple of historical payments so the detail drawer
        # has something to show. Embedded as an array on the parent doc.
        payments = []
        for i in range(1, 4):
            pay_date = now - timedelta(days=30 * i)
            payments.append({
                "date": pay_date,
                "amount": s["cost"]["amount"],
                "currency": s["cost"]["currency"],
                "amount_usd": cost_usd,
                "method": "card",
                "note": "auto-renewal",
            })
        doc = {
            "_id": sub_id,
            "user_id": DEMO_USER_ID,  # Demo user for local testing.
            "name": s["name"],
            "vendor": s["vendor"],
            "category": s["category"],
            "tags": s["tags"],
            "cost": s["cost"],
            "cost_usd": cost_usd,
            "billing_cycle": s["billing_cycle"],
            "next_renewal": next_renewal,
            "status": "active",
            "cancellation": None,
            "payments": payments,
            "created_at": now,
            "updated_at": now,
        }
        await db.subscriptions.insert_one(doc)
        await schedule_renewal(sub_id, next_renewal)
