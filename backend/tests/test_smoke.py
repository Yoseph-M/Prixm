"""Smoke test that verifies the app boots without Mongo/Redis (in-memory only).

Run with: pytest -q  (requires `mongomock-motor` for offline DB; otherwise
just import-check)."""

def test_imports():
    from app import main, db, redis_client, scheduler, fx, seed
    from app.routers import subscriptions, payments, dashboard, alerts
    assert main.app is not None
