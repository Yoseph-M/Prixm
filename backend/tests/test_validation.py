"""Pydantic validation rejects invalid subscription payloads."""
import pytest
from pydantic import ValidationError

from app.models import Money, SubscriptionIn
from datetime import datetime, timezone


def test_rejects_negative_amount():
    with pytest.raises(ValidationError):
        SubscriptionIn(
            name="Netflix",
            cost=Money(amount=-5.0, currency="USD"),
            next_renewal=datetime.now(timezone.utc),
        )


def test_rejects_invalid_currency():
    with pytest.raises(ValidationError):
        SubscriptionIn(
            name="Netflix",
            cost=Money(amount=9.99, currency="JPY"),  # type: ignore[arg-type]
            next_renewal=datetime.now(timezone.utc),
        )


def test_accepts_valid_subscription():
    sub = SubscriptionIn(
        name="Spotify",
        cost=Money(amount=9.99, currency="USD"),
        billing_cycle="monthly",
        next_renewal=datetime.now(timezone.utc),
    )
    assert sub.cost.amount == 9.99
