"""
MongoDB access layer.

SCHEMA DECISIONS
================
We use a SINGLE collection `subscriptions`. Each document represents one
recurring bill and EMBEDS its payment history as an array.

Why embed `payments[]` instead of a separate collection?
  * Locality: the dashboard and the detail drawer always read payments WITH
    the parent subscription. Embedding eliminates a join/`$lookup`.
  * Atomic writes: appending a payment is a single `$push` on one doc — no
    multi-document transaction needed.
  * Bounded growth: a personal subscription will accumulate ~12 payments/year.
    Even after a decade we are well below MongoDB's 16MB doc limit.
  * Document-shaped reads map 1:1 to the API response — fewer transforms.

When would we split it out into its own collection?
  * If payment history became unbounded (e.g. high-frequency metering).
  * If we needed cross-subscription analytics that scan ONLY payments
    (a separate collection with its own indexes is cheaper to scan).
  * If multiple parents could share payment events (many-to-many).

Denormalized field `cost_usd` stores the USD-normalized price at write time.
This trades a little write complexity for very fast dashboard aggregations
(no per-row currency conversion at read time, no FX dependency at read time).

MULTI-TENANCY
-------------
Every subscription document carries a `user_id` field set to the Firebase uid.
All queries include `{"user_id": uid}` to enforce tenant isolation at the DB layer.
The `user_id` index ensures these scoped queries are performant.

INDEXES
-------
  * `user_id` ascending for tenant-scoped queries (most important for multi-tenancy).
  * text index on `name` + `vendor` + `tags` for the search box.
  * `tags` ascending for tag-chip filtering.
  * `category` ascending for the spending-by-category aggregation.
  * `next_renewal` ascending for upcoming-renewals queries.
  * `status` ascending to quickly exclude cancelled subs from totals.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.MONGODB_DB]


async def ensure_indexes() -> None:
    db = get_db()
    coll = db.subscriptions

    # user_id index is critical for multi-tenancy — every query filters by it.
    await coll.create_index("user_id", name="user_id_asc")

    # Text index covers the search query parameter `q`.
    await coll.create_index(
        [("name", "text"), ("vendor", "text"), ("tags", "text")],
        name="search_text",
    )
    await coll.create_index("tags")
    await coll.create_index("category")
    await coll.create_index("next_renewal")
    await coll.create_index("status")

    # Users collection index for Firebase uid lookups.
    users = db.users
    await users.create_index("firebase_uid", unique=True, name="firebase_uid_unique")
