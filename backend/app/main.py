"""FastAPI entrypoint. Mounts routers, runs lifespan tasks, serves the UI."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .config import settings
from .db import ensure_indexes, get_db
from .logging_config import setup_logging
from .middleware.request_logging import RequestLoggingMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware
from .routers import alerts, analytics, auth, budgets, dashboard, payments, subscriptions
from .scheduler import schedule_renewal, scheduler_loop
from .seed import seed_if_empty
from .services.alert_scheduler_service import run_renewal_alert_scan
from .services.subscription_service import NOT_DELETED

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    await seed_if_empty()

    db = get_db()
    async for sub in db.subscriptions.find(
        {"status": "active", **NOT_DELETED}, {"next_renewal": 1}
    ):
        await schedule_renewal(sub["_id"], sub["next_renewal"])

    stop = asyncio.Event()
    legacy_task = asyncio.create_task(scheduler_loop(stop))

    aps = AsyncIOScheduler()
    aps.add_job(run_renewal_alert_scan, "interval", hours=1, id="renewal_alerts")
    aps.start()
    await run_renewal_alert_scan()

    try:
        yield
    finally:
        stop.set()
        legacy_task.cancel()
        aps.shutdown(wait=False)
        try:
            await legacy_task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="Prixm — Subscription Manager", lifespan=lifespan)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(subscriptions.router)
app.include_router(payments.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(budgets.router)


@app.get("/health")
async def health():
    return {"ok": True}


_INDEX_HTML = (Path(__file__).parent / "templates" / "index.html").read_text()


@app.get("/", response_class=HTMLResponse)
async def root():
    return _INDEX_HTML
