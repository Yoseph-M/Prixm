# Subscription & Bill Manager

A FastAPI + MongoDB Atlas + Redis prototype that tracks recurring bills,
normalizes everything to USD, fires renewal alerts (7d & 3d ahead), and shows
a clean dashboard.

## Quick start

### Option A — Docker (Mongo + Redis included)
```bash
docker compose up --build
# open http://localhost:8000
```

### Option B — Local Python against MongoDB Atlas
```bash
cp .env.example .env
# edit .env: set MONGODB_URI to your Atlas SRV string, leave REDIS_URL blank
# to use the in-memory fallback (great for demos).
pip install -r requirements.txt
uvicorn app.main:app --reload
# open http://localhost:8000
```

The app **seeds 8 realistic subscriptions** (Netflix, Spotify, AWS, Notion,
NYT, iCloud+, Figma, ChatGPT) on first boot, two of which fall inside the
3-day and 7-day alert windows so the alerts feed lights up immediately.

## Architecture

### MongoDB schema — single `subscriptions` collection with embedded payments
```
{
  _id, name, vendor, category, tags: [str],
  cost: { amount, currency },
  cost_usd,                         // denormalized for fast aggregations
  billing_cycle: monthly|yearly|weekly,
  next_renewal: ISODate,
  status: active|cancelled,
  cancellation: { date, reason } | null,
  payments: [                       // EMBEDDED (see app/db.py for rationale)
    { date, amount, currency, amount_usd, method, note }
  ],
  created_at, updated_at
}
```

**Why embed `payments[]`?** Locality, atomic `$push`, bounded growth (~12/yr),
and 1:1 mapping to the API response. We document when we'd split it out
inside `app/db.py`.

Indexes: text(`name`+`vendor`+`tags`), `tags`, `category`, `next_renewal`, `status`.

### Redis patterns
- **`renewals:zset`** — sorted set, member = subscription id, score = next
  renewal epoch. The scheduler does `ZRANGEBYSCORE now (now+7d)` once per
  minute. O(log N) writes, O(log N + M) range scans.
- **`alert:sent:{id}:{window}`** — string with TTL = window length, used as
  an idempotency guard so we don't re-fire the same alert.
- **`fx:rates`** — JSON blob of FX rates, 12h TTL.
- **`dashboard:totals`** — short-lived cache of the aggregation pipeline,
  invalidated on every write.

If `REDIS_URL` is empty, an in-memory class implements the same commands
(`zadd`, `zrangebyscore`, `set`, `get`, `delete`) so the prototype runs
without Redis. See `app/redis_client.py`.

## API
- `GET /subscriptions?q=&tag=&status=&category=` — list + search
- `POST /subscriptions` · `GET/PUT/DELETE /subscriptions/{id}`
- `POST /subscriptions/{id}/cancel` — `{reason, date?}`
- `GET/POST /subscriptions/{id}/payments` — payment history
- `GET /dashboard/totals` — KPIs + spend by category (monthly USD)
- `GET /alerts` — pending renewal alerts
- `GET /health`

## Project layout
```
app/
  main.py            FastAPI app, lifespan (seed + scheduler)
  config.py          settings via .env
  db.py              Mongo client + index setup + schema rationale
  redis_client.py    Redis client + in-memory fallback
  models.py          Pydantic schemas
  fx.py              live FX, cached, with static fallback
  scheduler.py       60s loop reading the renewals ZSET
  seed.py            8 sample subscriptions
  routers/           subscriptions, payments, dashboard, alerts
  templates/         dashboard UI (Tailwind + Chart.js, no build step)
```
