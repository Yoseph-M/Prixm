"""Pydantic models for API I/O. Mongo storage uses the same shape (plus _id)."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

BillingCycle = Literal["monthly", "yearly", "weekly"]
CurrencyCode = Literal["USD", "ETB", "EUR", "GBP"]
Status = Literal["active", "paused", "cancelled"]


class Money(BaseModel):
    amount: Annotated[float, Field(gt=0)]
    currency: CurrencyCode = "USD"


class Payment(BaseModel):
    date: datetime
    amount: Annotated[float, Field(gt=0)]
    currency: CurrencyCode
    amount_usd: Annotated[float, Field(ge=0)]
    method: str = Field(default="card", min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=500)


class Cancellation(BaseModel):
    date: datetime
    reason: str = Field(min_length=1, max_length=500)


class SubscriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    vendor: str | None = Field(default=None, max_length=200)
    category: str = Field(default="other", max_length=64)
    tags: list[str] = Field(default_factory=list, max_length=20)
    cost: Money
    billing_cycle: BillingCycle = "monthly"
    start_date: datetime | None = None
    next_renewal: datetime

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: list[str]) -> list[str]:
        for tag in tags:
            if not tag or len(tag) > 64:
                raise ValueError("tags must be between 1 and 64 characters")
        return tags


class StatusPatch(BaseModel):
    status: Literal["active", "paused", "cancelled"]


class SubscriptionOut(SubscriptionIn):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    cost_usd: float
    status: Status = "active"
    cancellation: Cancellation | None = None
    payments: list[Payment] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class CancelIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    date: datetime | None = None


class PaymentIn(BaseModel):
    amount: Annotated[float, Field(gt=0)]
    currency: CurrencyCode
    date: datetime | None = None
    method: str = Field(default="card", min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=500)


class PaginatedSubscriptions(BaseModel):
    data: list[dict]
    total: int
    page: int
    pages: int


class AnalyticsOut(BaseModel):
    monthly_spend_by_category: list[dict]
    monthly_spend_trend: list[dict]
    total_saved_cancelled_usd: float
    most_expensive_category: str | None
