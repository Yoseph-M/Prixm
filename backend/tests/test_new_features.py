"""Tests for new endpoints: payments, budgets, basis=annual, price hike, duplicates, ICS."""
import pytest
from datetime import datetime, timedelta
from app.models import PaymentIn, SubscriptionIn, Money, BudgetIn
from app.services import subscription_service as sub_svc
from app import scheduler


def test_new_imports():
    from app.routers import budgets
    from app.models import BudgetIn, BudgetOut
    assert budgets.router is not None


@pytest.mark.asyncio
async def test_duplicate_subscription_warning(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock
    db_mock = MagicMock()

    # Mock cursor for existing subscriptions
    async def mock_cursor_gen():
        yield {"_id": "sub1", "name": "Netflix Premium", "vendor": "Netflix", "category": "entertainment", "status": "active"}

    mock_cursor = MagicMock()
    mock_cursor.__aiter__ = lambda s: mock_cursor_gen()
    db_mock.subscriptions.find.return_value = mock_cursor
    db_mock.subscriptions.insert_one = AsyncMock()

    monkeypatch.setattr("app.services.subscription_service.get_db", lambda: db_mock)
    monkeypatch.setattr("app.services.subscription_service.to_usd", AsyncMock(return_value=15.99))
    monkeypatch.setattr("app.services.subscription_service.schedule_renewal", AsyncMock())
    monkeypatch.setattr("app.services.subscription_service.invalidate_user_caches", AsyncMock())

    sub_in = SubscriptionIn(
        name="Netflix",
        vendor="Netflix",
        category="entertainment",
        cost=Money(amount=15.99, currency="USD"),
        next_renewal=datetime.utcnow() + timedelta(days=30)
    )

    result = await sub_svc.create("user123", sub_in)
    assert "warning" in result
    assert "Possible duplicate" in result["warning"]
