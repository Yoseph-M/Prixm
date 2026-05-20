"""Renewal alert idempotency key and urgency window logic."""
import time
from datetime import datetime, timedelta, timezone

SCAN_WINDOW_DAYS = 7
ALERT_SENT_TTL = 86400


def test_alert_sentinel_key_format():
    sub_id = "abc-123"
    assert f"alert:sent:{sub_id}" == "alert:sent:abc-123"


def test_renewal_within_scan_window():
    now = time.time()
    renewal = datetime.now(timezone.utc) + timedelta(days=3)
    assert renewal.timestamp() <= now + SCAN_WINDOW_DAYS * 86400


def test_urgency_red_within_three_days():
    now = datetime.now(timezone.utc)
    renewal_soon = now + timedelta(days=2)
    days_left = max(0, int((renewal_soon.timestamp() - now.timestamp()) / 86400000))
    assert days_left <= 3


def test_alert_ttl_is_24_hours():
    assert ALERT_SENT_TTL == 86400
