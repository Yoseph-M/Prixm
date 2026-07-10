"""Pydantic validation rejects invalid subscription payloads."""
import pytest
from pydantic import ValidationError

from app.models import CancelIn, Money, PaymentIn, SubscriptionIn
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


def test_rejects_oversized_tag_list():
    with pytest.raises(ValidationError):
        SubscriptionIn(
            name="Spotify",
            cost=Money(amount=9.99, currency="USD"),
            tags=[f"tag-{i}" for i in range(21)],
            next_renewal=datetime.now(timezone.utc),
        )


def test_rejects_oversized_tag_value():
    with pytest.raises(ValidationError):
        SubscriptionIn(
            name="Spotify",
            cost=Money(amount=9.99, currency="USD"),
            tags=["x" * 65],
            next_renewal=datetime.now(timezone.utc),
        )


def test_rejects_oversized_freeform_text():
    with pytest.raises(ValidationError):
        CancelIn(reason="x" * 501)

    with pytest.raises(ValidationError):
        PaymentIn(amount=9.99, currency="USD", method="x" * 65)

    with pytest.raises(ValidationError):
        PaymentIn(amount=9.99, currency="USD", note="x" * 501)
